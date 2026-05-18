import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import DashboardLayout from '../../components/DashboardLayout';
import { Check, ChevronDown, Download, Calendar, Filter, Search, X } from 'lucide-react';

export default function Reports() {
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [employeeId, setEmployeeId] = useState('all');
  const [departmentId, setDepartmentId] = useState('all');
  const [status, setStatus] = useState('all');
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeePickerSearch, setEmployeePickerSearch] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const employeePickerRef = useRef<HTMLDivElement | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      if (employeeId !== 'all') {
        const { data } = await api.get(`/admin/reports/employee/${employeeId}?month=${month}`);
        setRecords(data.records);
        setSummary(data.summary);
      } else {
        const { data } = await api.get(`/admin/attendance/report?month=${month}&employee_id=${employeeId}&department_id=${departmentId}&status=${status}`);
        setRecords(data);
        setSummary(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/admin/employees').then(({ data }) => setEmployees(data));
    api.get('/admin/departments').then(({ data }) => setDepartments(data));
  }, []);

  useEffect(() => { fetchReports(); }, [month, employeeId, departmentId, status]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (employeePickerRef.current && !employeePickerRef.current.contains(event.target as Node)) {
        setEmployeePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async () => {
    const urlPath = employeeId !== 'all'
      ? `/admin/reports/employee/${employeeId}/export?month=${month}`
      : `/admin/attendance/report/export?month=${month}&employee_id=${employeeId}&department_id=${departmentId}&status=${status}`;
    const { data } = await api.get(urlPath, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance_report_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const statusBadge = (record: any) => {
    const status = String(record.status || (record.is_late ? 'late' : 'present')).toLowerCase();
    if (record.attendance_type === 'work_from_home' || status === 'work_from_home') {
      return 'bg-blue-50 text-blue-700';
    }
    if (record.attendance_type === 'on_duty' || status === 'on_duty') {
      return 'bg-purple-50 text-purple-700';
    }
    if (record.attendance_type === 'leave' || status === 'leave') {
      return 'bg-gray-100 text-gray-700';
    }
    if (record.is_late || status === 'late') {
      return 'bg-warning-bg text-warning-text';
    }
    if (status === 'absent') {
      return 'bg-danger-bg text-danger-text';
    }
    if (status === 'missing_checkout_auto_closed' || status === 'auto_checkout') {
      return 'bg-danger-bg text-danger-text';
    }
    return 'bg-success-bg text-success-text';
  };

  const statusText = (record: any) => {
    const status = String(record.status || '').toLowerCase();
    if (record.attendance_type === 'work_from_home') return 'WFH';
    if (record.attendance_type === 'on_duty') return 'On Duty';
    if (record.attendance_type === 'leave') return 'Leave';
    if (status === 'absent') return 'Absent';
    if (status === 'missing_checkout_auto_closed' || status === 'auto_checkout') return 'Auto Checkout';
    return record.is_late ? 'Late' : 'Present';
  };

  const normalizedSearch = employeePickerSearch.trim().toLowerCase();
  const filteredEmployees = normalizedSearch
    ? employees.filter((employee) => [employee.name, employee.email, employee.department_name].some((value) => String(value || '').toLowerCase().includes(normalizedSearch)))
    : employees;
  const selectedEmployee = employees.find((employee) => String(employee.id) === employeeId);
  const selectedEmployeeLabel = selectedEmployee?.name || 'Search or select employee';
  const selectEmployee = (id: string) => {
    setEmployeeId(id);
    setEmployeePickerOpen(false);
    setEmployeePickerSearch('');
  };

  return (
    <DashboardLayout title="Reports">
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monthly Reports</h1>
          <p className="mt-2 text-gray-500">Filter and export organization attendance data.</p>
        </div>
        <button onClick={handleExport} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 font-bold text-white hover:bg-blue-700">
          <Download size={18} /> Export CSV
        </button>
      </div>

      <div className="mb-6 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Month</span>
          <span className="relative block"><Calendar className="absolute left-3 top-3 text-gray-400" size={18} /><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full rounded-lg bg-[#F4F7FE] py-3 pl-10 pr-3 outline-none focus:ring-2 focus:ring-brand-light" /></span>
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Department</span>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-lg bg-[#F4F7FE] px-3 py-3 outline-none focus:ring-2 focus:ring-brand-light">
            <option value="all">All departments</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <div ref={employeePickerRef} className="relative">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Employee</span>
          <button
            type="button"
            onClick={() => setEmployeePickerOpen((open) => !open)}
            className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg bg-[#F4F7FE] px-3 py-3 text-left outline-none transition focus:ring-2 focus:ring-brand-light ${employeePickerOpen ? 'ring-2 ring-brand-light' : ''}`}
          >
            <span className="min-w-0">
              <span className={`block truncate text-base font-bold ${selectedEmployee ? 'text-gray-900' : 'text-gray-500'}`}>{employeeId === 'all' ? 'All Employees' : selectedEmployeeLabel}</span>
              {selectedEmployee && <span className="mt-0.5 block truncate text-xs text-gray-500">{selectedEmployee.email}{selectedEmployee.department_name ? ` • ${selectedEmployee.department_name}` : ''}</span>}
            </span>
            <ChevronDown size={18} className={`shrink-0 text-gray-500 transition ${employeePickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {employeePickerOpen && (
            <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/70">
              <div className="border-b border-gray-100 p-3">
                <span className="relative block">
                  <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    autoFocus
                    value={employeePickerSearch}
                    onChange={(event) => setEmployeePickerSearch(event.target.value)}
                    placeholder="Search employee by name or email"
                    className="w-full rounded-lg bg-[#F4F7FE] py-3 pl-10 pr-9 text-sm outline-none focus:ring-2 focus:ring-brand-light"
                  />
                  {employeePickerSearch && (
                    <button type="button" onClick={() => setEmployeePickerSearch('')} className="absolute right-2 top-2.5 rounded-md p-1 text-gray-400 hover:bg-white hover:text-gray-700">
                      <X size={16} />
                    </button>
                  )}
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                <button
                  type="button"
                  onClick={() => selectEmployee('all')}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-[#F4F7FE] ${employeeId === 'all' ? 'bg-brand-light text-brand' : 'text-gray-900'}`}
                >
                  <span>
                    <span className="block font-black">All Employees</span>
                    <span className="text-xs text-gray-500">Show everyone in the report</span>
                  </span>
                  {employeeId === 'all' && <Check size={18} className="shrink-0" />}
                </button>
                {filteredEmployees.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm font-bold text-gray-500">No employee found</div>
                ) : (
                  filteredEmployees.map((employee) => (
                    <button
                      type="button"
                      key={employee.id}
                      onClick={() => selectEmployee(String(employee.id))}
                      className={`mt-1 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-[#F4F7FE] ${String(employee.id) === employeeId ? 'bg-brand-light text-brand' : 'text-gray-900'}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-black">{employee.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-gray-500">{employee.email}{employee.department_name ? ` • ${employee.department_name}` : ''}</span>
                      </span>
                      {String(employee.id) === employeeId && <Check size={18} className="shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Status</span>
          <span className="relative block"><Filter className="absolute left-3 top-3 text-gray-400" size={18} /><select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg bg-[#F4F7FE] py-3 pl-10 pr-3 outline-none focus:ring-2 focus:ring-brand-light">
            <option value="all">All statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="work_from_home">WFH</option>
            <option value="on_duty">On Duty</option>
            <option value="leave">Leave</option>
            <option value="missing_checkout">Missing checkout</option>
          </select></span>
        </label>
      </div>

      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ['Present', summary.present_days || 0, 'text-success-text'],
            ['Late', summary.late_days || 0, 'text-warning-text'],
            ['WFH', summary.wfh_days || 0, 'text-blue-700'],
            ['On Duty', summary.on_duty_days || 0, 'text-purple-700'],
            ['Leave', summary.leave_days || 0, 'text-gray-700'],
            ['Hours', `${Math.round(((summary.working_minutes || 0) / 60) * 10) / 10}h`, 'text-brand'],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="text-base font-black text-gray-600">{label}</div>
              <div className={`mt-2 text-4xl font-black ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left">
            <thead className="bg-[#F4F7FE] text-xs uppercase tracking-wider text-gray-500">
              <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Check In</th><th className="px-5 py-3">Check Out</th><th className="px-5 py-3">Hours</th><th className="px-5 py-3">Not Onsite</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Note</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-500">Loading report...</td></tr> : records.length === 0 ? <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-500">No records match these filters.</td></tr> : records.map((record) => (
                <tr key={record.id}>
                  <td className="px-5 py-4 text-sm font-medium">{record.date}</td>
                  <td className="px-5 py-4"><div className="font-bold">{record.name}</div><div className="text-xs text-gray-500">{record.department_name || 'No department'} • {record.email}</div></td>
                  <td className="px-5 py-4 text-sm capitalize">{String(record.attendance_type || 'on_site').replaceAll('_', ' ')}</td>
                  <td className="px-5 py-4 text-sm">{record.check_in_time?.substring(0, 5) || '--'}</td>
                  <td className="px-5 py-4 text-sm">{record.check_out_time?.substring(0, 5) || '--'}</td>
                  <td className="px-5 py-4 text-sm">{record.working_minutes ? `${Math.floor(record.working_minutes / 60)}h ${record.working_minutes % 60}m` : '--'}</td>
                  <td className="px-5 py-4 text-sm">{record.not_onsite_minutes ? `${record.not_onsite_minutes}m (${record.geofence_breach_count || 0})` : '--'}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge(record)}`}>{statusText(record)}</span></td>
                  <td className="px-5 py-4 text-sm text-gray-500">{record.admin_note || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 md:hidden">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading report...</div>
          ) : records.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No records match these filters.</div>
          ) : records.map((record) => (
            <article key={record.id} className="p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-black text-gray-900">{record.name}</div>
                  <div className="mt-1 text-xs text-gray-500">{record.date} • {record.department_name || 'No department'}</div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusBadge(record)}`}>{statusText(record)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Type</div>
                  <div className="mt-1 font-semibold capitalize text-gray-800">{String(record.attendance_type || 'on_site').replaceAll('_', ' ')}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Hours</div>
                  <div className="mt-1 font-semibold text-gray-800">{record.working_minutes ? `${Math.floor(record.working_minutes / 60)}h ${record.working_minutes % 60}m` : '--'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Check In</div>
                  <div className="mt-1 font-semibold text-gray-800">{record.check_in_time?.substring(0, 5) || '--'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Check Out</div>
                  <div className="mt-1 font-semibold text-gray-800">{record.check_out_time?.substring(0, 5) || '--'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Not Onsite</div>
                  <div className="mt-1 font-semibold text-gray-800">{record.not_onsite_minutes ? `${record.not_onsite_minutes}m (${record.geofence_breach_count || 0})` : '--'}</div>
                </div>
              </div>
              {(record.admin_note || record.email) && (
                <div className="mt-3 rounded-lg bg-[#F4F7FE] px-3 py-2 text-xs text-gray-600">
                  {record.admin_note || record.email}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
