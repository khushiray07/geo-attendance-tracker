import { useEffect, useState } from 'react';
import api from '../../api/axios';
import DashboardLayout from '../../components/DashboardLayout';

export default function EmployeeCalendar() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [records, setRecords] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  useEffect(() => {
    api.get('/admin/employees').then(({ data }) => {
      setEmployees(data);
      if (data[0]) setEmployeeId(String(data[0].id));
    });
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    api.get(`/admin/attendance/employee/${employeeId}/calendar?month=${month}`).then(({ data }) => setRecords(data));
  }, [employeeId, month]);

  const recordByDate = new Map(records.map((record) => [dateKey(record.date), record]));

  return (
    <DashboardLayout title="Calendar">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-950">Employee Calendar</h1>
          <p className="mt-2 text-gray-500">Review date-wise attendance for a selected employee.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-brand-light">
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </select>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-brand-light" />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-black">
          <Legend label="Present" className="bg-success-bg text-success-text" />
          <Legend label="On Time" className="bg-green-50 text-green-700" />
          <Legend label="Late" className="bg-warning-bg text-warning-text" />
          <Legend label="Absent" className="bg-danger-bg text-danger-text" />
          <Legend label="Pending" className="bg-[#F4F7FE] text-gray-600" />
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase tracking-wider text-gray-400">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day}>{day}</div>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {calendarDays(month).map((day) => {
            const record = day.inMonth ? displayRecord(day, recordByDate.get(day.date)) : null;
            const badge = statusLabel(record);
            return (
              <button
                key={day.key}
                disabled={!day.inMonth}
                onClick={() => record && setSelectedRecord(record)}
                className={`min-h-24 rounded-xl border p-2 text-left transition ${day.inMonth ? 'border-gray-100 bg-[#FAFBFF] hover:border-brand-light' : 'border-transparent'} ${record ? 'cursor-pointer' : ''}`}
              >
                <div className="font-black text-gray-900">{day.label}</div>
                {day.inMonth && badge && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${badge.className}`}>{badge.text}</span>
                    {badge.meta && <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${badge.metaClassName}`}>{badge.meta}</span>}
                  </div>
                )}
                {day.inMonth && record?.not_onsite_minutes > 0 && <div className="mt-1 inline-flex rounded-full bg-warning-bg px-2 py-1 text-[11px] font-black text-warning-text">Away {record.not_onsite_minutes}m</div>}
              </button>
            );
          })}
        </div>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelectedRecord(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-2xl font-black text-gray-950">{selectedRecord.date}</h3>
            <div className="mt-4 space-y-3 text-sm">
              <Detail label="Type" value={String(selectedRecord.attendance_type || 'on_site').replaceAll('_', ' ')} />
              <Detail label="Check-in" value={selectedRecord.check_in_time?.substring(0, 5) || '--'} />
              <Detail label="Check-out" value={selectedRecord.check_out_time?.substring(0, 5) || '--'} />
              <Detail label="Hours" value={selectedRecord.working_minutes ? `${Math.floor(selectedRecord.working_minutes / 60)}h ${selectedRecord.working_minutes % 60}m` : '--'} />
              <Detail label="Not onsite" value={selectedRecord.not_onsite_minutes ? `${selectedRecord.not_onsite_minutes}m across ${selectedRecord.geofence_breach_count || 0} interval(s)` : '--'} />
              <Detail label="Note" value={selectedRecord.admin_note || '--'} />
            </div>
            <button onClick={() => setSelectedRecord(null)} className="mt-6 w-full rounded-lg bg-brand py-3 font-bold text-white">Close</button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function calendarDays(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const first = new Date(year, monthIndex - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateText = dateKey(date);
    return { key: `${dateText}-${index}`, date: dateText, label: date.getDate(), inMonth: date.getMonth() === monthIndex - 1 };
  });
}

function dateKey(value: string | Date) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function displayRecord(day: { date: string; inMonth: boolean }, record: any) {
  const today = dateKey(new Date());
  if (!day.inMonth || day.date > today) return null;

  if (record) {
    const normalizedRecord = { ...record, date: dateKey(record.date) };
    if (String(normalizedRecord.status || '').toLowerCase() === 'pending') {
      return {
        ...normalizedRecord,
        status: 'absent_today',
        admin_note: normalizedRecord.admin_note || 'No attendance recorded today'
      };
    }
    return normalizedRecord;
  }

  return {
    id: `absent-${day.date}`,
    date: day.date,
    check_in_time: null,
    check_out_time: null,
    working_minutes: 0,
    is_late: false,
    status: day.date === today ? 'absent_today' : 'absent',
    attendance_type: 'on_site',
    admin_note: day.date === today ? 'No attendance recorded today' : 'No attendance record for this working day',
    virtual: true
  };
}

function statusLabel(record: any) {
  if (!record) return null;
  const status = String(record.status || '').toLowerCase();
  if (record.attendance_type === 'work_from_home') return { text: 'WFH', className: 'bg-blue-50 text-blue-700' };
  if (record.attendance_type === 'on_duty') return { text: 'On Duty', className: 'bg-purple-50 text-purple-700' };
  if (record.attendance_type === 'leave') return { text: 'Leave', className: 'bg-gray-200 text-gray-700' };
  if (status === 'absent' || status === 'absent_today') return { text: status === 'absent_today' ? 'Absent Today' : 'Absent', className: 'bg-danger-bg text-danger-text' };
  if (status === 'missing_checkout_auto_closed' || status === 'auto_checkout') return { text: 'Auto Checkout', className: 'bg-danger-bg text-danger-text' };
  if (record.check_in_time && !record.check_out_time) return { text: 'Missing Checkout', className: 'bg-danger-bg text-danger-text' };
  if (record.is_late || status === 'late') return { text: 'Present', className: 'bg-success-bg text-success-text', meta: 'Late', metaClassName: 'bg-warning-bg text-warning-text' };
  return { text: 'Present', className: 'bg-success-bg text-success-text', meta: 'On Time', metaClassName: 'bg-green-50 text-green-700' };
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 rounded-lg bg-[#F4F7FE] p-3"><span className="font-bold text-gray-500">{label}</span><span className="font-black capitalize text-gray-900">{value}</span></div>;
}

function Legend({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-full px-3 py-1 ${className}`}>{label}</span>;
}
