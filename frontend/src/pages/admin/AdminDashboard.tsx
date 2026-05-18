import { useEffect, useState } from 'react';
import api from '../../api/axios';
import DashboardLayout from '../../components/DashboardLayout';
import { Briefcase, Home, Users, UserCheck, Clock, Search, MoreVertical, MapPin, PlayCircle } from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [breaches, setBreaches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoCheckoutRunning, setAutoCheckoutRunning] = useState(false);
  const [autoCheckoutMessage, setAutoCheckoutMessage] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [departmentId, setDepartmentId] = useState('all');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchToday();
  }, [departmentId, date]);

  useEffect(() => {
    api.get('/admin/departments').then(({ data }) => setDepartments(data));
  }, []);

  const fetchToday = async () => {
    try {
      const res = await api.get(`/admin/dashboard?department_id=${departmentId}&date=${date}`);
      setSummary(res.data);
      setData(res.data.employees || []);
      const breachRes = await api.get(`/admin/attendance/geofence-breaches?date=${date}`);
      setBreaches(breachRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(d => {
    if (filter === 'PRESENT') return d.check_in_time;
    if (filter === 'LATE') return d.is_late;
    if (filter === 'WFH') return d.attendance_type === 'work_from_home';
    if (filter === 'ON_DUTY') return d.attendance_type === 'on_duty';
    if (filter === 'ABSENT') return !d.check_in_time;
    return true;
  });

  const getStatusPill = (record: any) => {
    const status = String(record.status || '').toLowerCase();
    if (record.attendance_type === 'work_from_home') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">WFH</span>;
    if (record.attendance_type === 'on_duty') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700">On Duty</span>;
    if (record.attendance_type === 'leave') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Leave</span>;
    if (status === 'missing_checkout_auto_closed' || status === 'auto_checkout') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-danger-bg text-danger-text">Auto Checkout</span>;
    if (!record.check_in_time) {
      return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-danger-bg text-danger-text">Absent</span>;
    }
    if (record.is_late) {
       return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-warning-bg text-warning-text">Late Arrival</span>;
    }
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-success-bg text-success-text">Present</span>;
  };

  const runAutoCheckoutNow = async () => {
    setAutoCheckoutRunning(true);
    setAutoCheckoutMessage('');
    try {
      const { data } = await api.post('/admin/attendance/auto-checkout');
      setAutoCheckoutMessage(data.message || `Auto checkout completed for ${data.closedCount || 0} record(s).`);
      await fetchToday();
    } catch (err) {
      setAutoCheckoutMessage((err as any).response?.data?.message || 'Failed to run auto checkout');
    } finally {
      setAutoCheckoutRunning(false);
    }
  };

  return (
    <DashboardLayout title="Dashboard">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-950">Organization Dashboard</h1>
          <p className="mt-1 text-gray-500">Track attendance by date and department.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-brand-light" />
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-brand-light">
            <option value="all">All departments</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <button
            type="button"
            onClick={runAutoCheckoutNow}
            disabled={autoCheckoutRunning}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-3 font-bold text-white transition hover:bg-gray-800 disabled:opacity-50 sm:col-span-2"
          >
            <PlayCircle size={18} />
            {autoCheckoutRunning ? 'Running...' : 'Run Auto Checkout Now'}
          </button>
        </div>
      </div>

      {autoCheckoutMessage && (
        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
          {autoCheckoutMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between min-h-36">
          <div className="flex justify-between items-start">
            <div className="text-base font-black text-gray-700">Total Employees</div>
            <Users size={24} className="text-brand" />
          </div>
          <div>
            <div className="text-4xl font-black text-gray-900 mb-1">{summary.active_employees || 0}</div>
            <div className="text-sm text-gray-500">Active Staff</div>
          </div>
        </div>
        <div className="bg-[#E6F8F0] p-6 rounded-xl border border-green-100 shadow-sm flex flex-col justify-between min-h-36">
          <div className="flex justify-between items-start">
            <div className="text-base font-black text-success-text">Present Today</div>
            <UserCheck size={24} className="text-success-text" />
          </div>
          <div>
            <div className="text-4xl font-black text-success-text mb-1">{summary.present_today || 0}</div>
            <div className="text-sm text-success-text opacity-80">Checked in today</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between min-h-36">
          <div className="flex justify-between items-start">
            <div className="text-base font-black text-gray-700">Late Today</div>
            <Clock size={24} className="text-warning-text" />
          </div>
          <div>
            <div className="text-4xl font-black text-warning-text mb-1">{summary.late_arrivals || 0}</div>
            <div className="text-sm text-gray-500">After shift grace</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between min-h-36">
          <div className="flex justify-between items-start">
            <div className="text-base font-black text-gray-700">WFH Today</div>
            <Home size={24} className="text-blue-600" />
          </div>
          <div>
            <div className="text-4xl font-black text-blue-700 mb-1">{summary.wfh_today || 0}</div>
            <div className="text-sm text-gray-500">Admin approved</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between min-h-36">
          <div className="flex justify-between items-start">
            <div className="text-base font-black text-gray-700">On Duty</div>
            <Briefcase size={24} className="text-purple-600" />
          </div>
          <div>
            <div className="text-4xl font-black text-purple-700 mb-1">{summary.on_duty_today || 0}</div>
            <div className="text-sm text-gray-500">Field work</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Search employees..." 
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-sm"
          />
        </div>
        
        <div className="overflow-x-auto pb-1 md:pb-0">
          <div className="flex min-w-max bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            {['ALL', 'PRESENT', 'LATE', 'WFH', 'ON_DUTY', 'ABSENT'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`min-h-10 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                  filter === f 
                    ? 'bg-brand text-white' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-gray-950"><MapPin size={20} className="text-warning-text" /> Geofence Alerts Today</h2>
            <p className="mt-1 text-sm text-gray-500">Employees outside or previously away from the office geofence during an active session.</p>
          </div>
          <div className="rounded-full bg-warning-bg px-3 py-1 text-xs font-black text-warning-text">{breaches.length} interval{breaches.length === 1 ? '' : 's'}</div>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left">
            <thead className="bg-[#F4F7FE] text-xs uppercase tracking-wider text-gray-500">
              <tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Outside At</th><th className="px-5 py-3">Returned At</th><th className="px-5 py-3">Duration</th><th className="px-5 py-3">Reason</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {breaches.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">No geofence alerts for this date.</td></tr>
              ) : breaches.map((breach) => (
                <tr key={breach.id}>
                  <td className="px-5 py-4"><div className="font-bold text-gray-900">{breach.name}</div><div className="text-xs text-gray-500">{breach.email}</div></td>
                  <td className="px-5 py-4 text-sm">{breach.department_name || '--'}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${breach.status === 'open' ? 'bg-warning-bg text-warning-text' : 'bg-success-bg text-success-text'}`}>{breach.status === 'open' ? 'Outside Geofence' : 'Returned'}</span></td>
                  <td className="px-5 py-4 text-sm">{formatTime(breach.started_at)}</td>
                  <td className="px-5 py-4 text-sm">{breach.ended_at ? formatTime(breach.ended_at) : '--'}</td>
                  <td className="px-5 py-4 text-sm font-bold">{breach.current_duration_minutes || 0}m</td>
                  <td className="px-5 py-4 text-sm text-gray-500">{breach.reason || 'Away from office geofence'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-gray-100 md:hidden">
          {breaches.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No geofence alerts for this date.</div>
          ) : breaches.map((breach) => (
            <article key={breach.id} className="p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-black text-gray-900">{breach.name}</div>
                  <div className="text-xs text-gray-500">{breach.department_name || 'No department'}</div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${breach.status === 'open' ? 'bg-warning-bg text-warning-text' : 'bg-success-bg text-success-text'}`}>{breach.status === 'open' ? 'Outside' : 'Returned'}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Outside At" value={formatTime(breach.started_at)} />
                <Info label="Returned At" value={breach.ended_at ? formatTime(breach.ended_at) : '--'} />
                <Info label="Duration" value={`${breach.current_duration_minutes || 0}m`} />
                <Info label="Reason" value={breach.reason || 'Away from geofence'} />
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4F7FE] border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tl-2xl">Employee</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Check-in</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Check-out</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Hours</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right rounded-tr-2xl"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">Loading records...</td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">No records found.</td>
                </tr>
              ) : (
                filteredData.map(record => (
                  <tr key={record.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 overflow-hidden shadow-sm">
                          {record.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{record.name}</div>
                          <div className="text-xs text-gray-500">{record.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {record.check_in_time ? record.check_in_time.substring(0,5) + ' AM' : '--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {record.department_name || '--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {record.check_out_time ? record.check_out_time.substring(0,5) + ' PM' : '--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {record.working_minutes ? `${Math.floor(record.working_minutes / 60)}h ${record.working_minutes % 60}m` : '--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusPill(record)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400 hover:text-gray-600 cursor-pointer">
                      <MoreVertical size={20} className="inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 md:hidden">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading records...</div>
          ) : filteredData.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No records found.</div>
          ) : (
            filteredData.map(record => (
              <article key={record.user_id} className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 font-bold text-gray-600 shadow-sm">
                      {record.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-base font-black text-gray-900">{record.name}</div>
                      <div className="truncate text-xs text-gray-500">{record.email}</div>
                    </div>
                  </div>
                  <div className="shrink-0">{getStatusPill(record)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Check-in</div>
                    <div className="mt-1 font-semibold text-gray-800">{record.check_in_time ? record.check_in_time.substring(0,5) : '--'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Check-out</div>
                    <div className="mt-1 font-semibold text-gray-800">{record.check_out_time ? record.check_out_time.substring(0,5) : '--'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Department</div>
                    <div className="mt-1 font-semibold text-gray-800">{record.department_name || '--'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Hours</div>
                    <div className="mt-1 font-semibold text-gray-800">{record.working_minutes ? `${Math.floor(record.working_minutes / 60)}h ${record.working_minutes % 60}m` : '--'}</div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</div><div className="mt-1 font-semibold text-gray-800">{value}</div></div>;
}
