import { useEffect, useState } from 'react';
import api from '../../api/axios';
import DashboardLayout from '../../components/DashboardLayout';
import { Briefcase, Home, Users, UserCheck, Clock, Search, MoreVertical } from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (record.attendance_type === 'work_from_home') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">WFH</span>;
    if (record.attendance_type === 'on_duty') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700">On Duty</span>;
    if (record.attendance_type === 'leave') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Leave</span>;
    if (!record.check_in_time) {
      return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-danger-bg text-danger-text">Absent</span>;
    }
    if (record.is_late) {
       return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-warning-bg text-warning-text">Late Arrival</span>;
    }
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-success-bg text-success-text">Present</span>;
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
        </div>
      </div>

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
        
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {['ALL', 'PRESENT', 'LATE', 'WFH', 'ON_DUTY', 'ABSENT'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
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
      </div>
    </DashboardLayout>
  );
}
