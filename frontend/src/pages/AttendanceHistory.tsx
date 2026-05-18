import { useEffect, useState } from 'react';
import api from '../api/axios';
import DashboardLayout from '../components/DashboardLayout';
import { MoreVertical } from 'lucide-react';

export default function AttendanceHistory() {
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const explicitAbsences = records.filter((record) => record.status === 'absent').length;

  useEffect(() => {
    fetchHistory();
  }, [month]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/attendance/history?month=${month}`);
      setRecords(data);
      const summaryRes = await api.get(`/attendance/summary?month=${month}`);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusPill = (record: any) => {
    if (record.attendance_type === 'work_from_home') {
      return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span> WFH</span>;
    }
    if (record.attendance_type === 'on_duty') {
      return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700"><span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span> On Duty</span>;
    }
    if (record.attendance_type === 'leave') {
      return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span> Leave</span>;
    }
    if (record.status === 'absent') {
      return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600"><span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Absent</span>;
    }
    if (record.check_in_time && !record.check_out_time) {
       return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-danger-bg text-danger-text"><span className="w-1.5 h-1.5 rounded-full bg-danger-text"></span> Missing Checkout</span>;
    }
    if (record.is_late) {
       return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning-bg text-warning-text"><span className="w-1.5 h-1.5 rounded-full bg-warning-text"></span> Late</span>;
    }
    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success-bg text-success-text"><span className="w-1.5 h-1.5 rounded-full bg-success-text"></span> Present</span>;
  };

  return (
    <DashboardLayout title="History">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Attendance History</h1>
          <p className="text-gray-500">Track your work hours and attendance patterns.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Select Reporting Period</label>
          <input 
            type="month" 
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full md:w-auto px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-light focus:border-brand font-medium text-gray-700 shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs font-bold text-gray-500 tracking-wider mb-2">Total Days</div>
          <div className="text-3xl font-bold text-gray-900">{summary.present_days || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs font-bold text-gray-500 tracking-wider mb-2">Work Hours</div>
          <div className="text-3xl font-bold text-brand">{Math.round(((summary.working_minutes || 0) / 60) * 10) / 10}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs font-bold text-gray-500 tracking-wider mb-2">Late Arrivals</div>
          <div className="text-3xl font-bold text-warning-text">{summary.late_days || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs font-bold text-gray-500 tracking-wider mb-2">Absences</div>
          <div className="text-3xl font-bold text-danger-text">{summary.absent_days ?? explicitAbsences}</div>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-3 sm:p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-950">Monthly Calendar</h2>
          <div className="text-sm font-bold text-gray-500">{month}</div>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-400">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day}>{day}</div>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays(month).map((day) => {
            const record = records.find((item) => item.date === day.date);
            const badge = statusLabel(record);
            return (
              <button
                key={day.key}
                disabled={!day.inMonth}
                onClick={() => record && setSelectedRecord(record)}
                className={`min-h-14 sm:min-h-20 rounded-lg sm:rounded-xl border p-1.5 sm:p-2 text-left transition ${day.inMonth ? 'border-gray-100 bg-[#FAFBFF] hover:border-brand-light' : 'border-transparent bg-transparent'} ${record ? 'cursor-pointer' : ''}`}
              >
                <div className="text-xs sm:text-base font-black text-gray-900">{day.label}</div>
                {day.inMonth && badge && (
                  <div className={`mt-1 sm:mt-3 inline-flex max-w-full rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-black ${badge.className}`}>{badge.shortText || badge.text}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4F7FE] border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tl-2xl">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Check-in</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Check-out</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Working Hours</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right rounded-tr-2xl">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">Loading records...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500 bg-white">No records found for this period.</td>
                </tr>
              ) : (
                records.map(record => {
                  const dateObj = new Date(record.date);
                  return (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {record.check_in_time ? record.check_in_time.substring(0,5) + ' AM' : '--:--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {record.check_out_time ? record.check_out_time.substring(0,5) + ' PM' : '--:--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {record.working_minutes > 0 ? `${Math.floor(record.working_minutes / 60)}h ${record.working_minutes % 60}m` : '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusPill(record)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400 hover:text-gray-600 cursor-pointer">
                        <MoreVertical size={20} className="inline-block" />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelectedRecord(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-2xl font-black text-gray-950">{selectedRecord.date}</h3>
            <div className="mt-4 space-y-3 text-sm">
              <Detail label="Attendance type" value={String(selectedRecord.attendance_type || 'on_site').replaceAll('_', ' ')} />
              <Detail label="Check-in" value={selectedRecord.check_in_time?.substring(0, 5) || '--'} />
              <Detail label="Check-out" value={selectedRecord.check_out_time?.substring(0, 5) || '--'} />
              <Detail label="Working hours" value={selectedRecord.working_minutes ? `${Math.floor(selectedRecord.working_minutes / 60)}h ${selectedRecord.working_minutes % 60}m` : '--'} />
              <Detail label="Late status" value={selectedRecord.is_late ? 'Late' : 'On time'} />
              <Detail label="Notes" value={selectedRecord.admin_note || '--'} />
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
    return {
      key: `${dateText}-${index}`,
      date: dateText,
      label: date.getDate(),
      inMonth: date.getMonth() === monthIndex - 1
    };
  });
}

function statusLabel(record: any) {
  if (!record) return null;
  if (record.attendance_type === 'work_from_home') return { text: 'WFH', shortText: 'WFH', className: 'bg-blue-50 text-blue-700' };
  if (record.attendance_type === 'on_duty') return { text: 'On Duty', shortText: 'Duty', className: 'bg-purple-50 text-purple-700' };
  if (record.attendance_type === 'leave') return { text: 'Leave', shortText: 'Leave', className: 'bg-gray-200 text-gray-700' };
  if (record.status === 'absent') return { text: 'Absent', shortText: 'Abs', className: 'bg-gray-100 text-gray-600' };
  if (record.check_in_time && !record.check_out_time) return { text: 'Missing Checkout', shortText: 'Open', className: 'bg-danger-bg text-danger-text' };
  if (record.is_late) return { text: 'Late', shortText: 'Late', className: 'bg-warning-bg text-warning-text' };
  return { text: 'Present', shortText: 'In', className: 'bg-success-bg text-success-text' };
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 rounded-lg bg-[#F4F7FE] p-3"><span className="font-bold text-gray-500">{label}</span><span className="font-black capitalize text-gray-900">{value}</span></div>;
}
