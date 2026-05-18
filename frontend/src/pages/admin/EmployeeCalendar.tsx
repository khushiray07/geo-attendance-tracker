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
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase tracking-wider text-gray-400">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day}>{day}</div>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {calendarDays(month).map((day) => {
            const record = records.find((item) => item.date === day.date);
            const badge = statusLabel(record);
            return (
              <button
                key={day.key}
                disabled={!day.inMonth}
                onClick={() => record && setSelectedRecord(record)}
                className={`min-h-20 rounded-xl border p-2 text-left ${day.inMonth ? 'border-gray-100 bg-[#FAFBFF] hover:border-brand-light' : 'border-transparent'}`}
              >
                <div className="font-black text-gray-900">{day.label}</div>
                {day.inMonth && <div className={`mt-3 inline-flex rounded-full px-2 py-1 text-[11px] font-black ${badge.className}`}>{badge.text}</div>}
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
    const dateText = date.toISOString().split('T')[0];
    return { key: `${dateText}-${index}`, date: dateText, label: date.getDate(), inMonth: date.getMonth() === monthIndex - 1 };
  });
}

function statusLabel(record: any) {
  if (!record) return { text: 'Absent', className: 'bg-gray-100 text-gray-500' };
  if (record.attendance_type === 'work_from_home') return { text: 'WFH', className: 'bg-blue-50 text-blue-700' };
  if (record.attendance_type === 'on_duty') return { text: 'On Duty', className: 'bg-purple-50 text-purple-700' };
  if (record.attendance_type === 'leave') return { text: 'Leave', className: 'bg-gray-200 text-gray-700' };
  if (record.is_late) return { text: 'Late', className: 'bg-warning-bg text-warning-text' };
  return { text: 'Present', className: 'bg-success-bg text-success-text' };
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 rounded-lg bg-[#F4F7FE] p-3"><span className="font-bold text-gray-500">{label}</span><span className="font-black capitalize text-gray-900">{value}</span></div>;
}
