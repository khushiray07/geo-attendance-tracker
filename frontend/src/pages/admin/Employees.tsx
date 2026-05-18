import React, { useEffect, useState } from 'react';
import { Copy, RefreshCcw, UserPlus } from 'lucide-react';
import api from '../../api/axios';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';

export default function Employees() {
  const { user, refreshUser } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', shift_start_time: '09:00', department_id: '' });
  const [exception, setException] = useState({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    attendance_type: 'work_from_home',
    reason: ''
  });

  const fetchEmployees = async () => {
    setLoading(true);
    const { data } = await api.get('/admin/employees');
    setEmployees(data);
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);
  useEffect(() => {
    api.get('/admin/departments').then(({ data }) => setDepartments(data));
  }, []);

  const copyInvite = async () => {
    const code = user?.organization?.invite_code || '';
    await navigator.clipboard?.writeText(code);
    setMessage('Invite code copied');
  };

  const regenerate = async () => {
    const { data } = await api.post('/organizations/regenerate-invite-code');
    setMessage(`New invite code: ${data.invite_code}`);
    await refreshUser();
  };

  const addEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    const { data } = await api.post('/admin/employees', form);
    setEmployees((current) => [data, ...current]);
    setForm({ name: '', email: '', password: '', shift_start_time: '09:00', department_id: '' });
    setMessage('Employee created');
  };

  const updateEmployee = async (employee: any, patch: any) => {
    const { data } = await api.put(`/admin/employees/${employee.id}`, { ...employee, ...patch });
    setEmployees((current) => current.map((item) => item.id === data.id ? data : item));
  };

  const saveException = async (event: React.FormEvent) => {
    event.preventDefault();
    await api.post('/admin/attendance/exception', exception);
    setMessage('Attendance exception saved');
    setException({ employee_id: '', date: new Date().toISOString().split('T')[0], attendance_type: 'work_from_home', reason: '' });
  };

  return (
    <DashboardLayout title="Employees">
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employee Management</h1>
          <p className="mt-2 text-gray-500">Invite employees, add accounts manually, and manage shift settings.</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Invite Code</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-lg bg-gray-100 px-3 py-2 text-lg font-black text-gray-900">{user?.organization?.invite_code}</code>
            <button onClick={copyInvite} className="rounded-lg border border-gray-200 p-2 text-brand hover:bg-brand-light" title="Copy invite code"><Copy size={18} /></button>
            <button onClick={regenerate} className="rounded-lg border border-gray-200 p-2 text-gray-700 hover:bg-gray-50" title="Regenerate invite code"><RefreshCcw size={18} /></button>
          </div>
        </div>
      </div>

      {message && <div className="mb-6 rounded-lg border border-green-200 bg-success-bg px-4 py-3 text-sm font-bold text-success-text">{message}</div>}

      <form onSubmit={addEmployee} className="mb-8 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_1fr_150px_140px_170px_auto]">
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Employee name" className="rounded-lg bg-[#F4F7FE] px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light" />
        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-lg bg-[#F4F7FE] px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light" />
        <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" className="rounded-lg bg-[#F4F7FE] px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light" />
        <input required type="time" value={form.shift_start_time} onChange={(e) => setForm({ ...form, shift_start_time: e.target.value })} className="rounded-lg bg-[#F4F7FE] px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light" />
        <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="rounded-lg bg-[#F4F7FE] px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light">
          <option value="">Department</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-bold text-white hover:bg-blue-700"><UserPlus size={18} /> Add</button>
      </form>

      <form onSubmit={saveException} className="mb-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-black text-gray-950">Mark Attendance Exception</h2>
          <p className="text-sm text-gray-500">Mark WFH, on-duty, leave, or on-site for a selected employee and date.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_160px_180px_1.5fr_auto]">
          <select required value={exception.employee_id} onChange={(e) => setException({ ...exception, employee_id: e.target.value })} className="rounded-lg bg-[#F4F7FE] px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light">
            <option value="">Select employee</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </select>
          <input required type="date" value={exception.date} onChange={(e) => setException({ ...exception, date: e.target.value })} className="rounded-lg bg-[#F4F7FE] px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light" />
          <select value={exception.attendance_type} onChange={(e) => setException({ ...exception, attendance_type: e.target.value })} className="rounded-lg bg-[#F4F7FE] px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light">
            <option value="work_from_home">Work From Home</option>
            <option value="on_duty">On Duty</option>
            <option value="leave">Leave</option>
            <option value="on_site">On-site</option>
          </select>
          <input required value={exception.reason} onChange={(e) => setException({ ...exception, reason: e.target.value })} placeholder="Reason or comment" className="rounded-lg bg-[#F4F7FE] px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light" />
          <button className="rounded-lg bg-gray-950 px-4 py-3 font-bold text-white hover:bg-gray-800">Save</button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left">
            <thead className="bg-[#F4F7FE] text-xs uppercase tracking-wider text-gray-500">
              <tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Shift</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td className="px-5 py-8 text-center text-gray-500" colSpan={5}>Loading employees...</td></tr> : employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-5 py-4"><div className="font-bold">{employee.name}</div><div className="text-sm text-gray-500">{employee.email}</div></td>
                  <td className="px-5 py-4">
                    <select value={employee.department_id || ''} onChange={(e) => updateEmployee(employee, { department_id: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2">
                      <option value="">Unassigned</option>
                      {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-4"><input type="time" value={employee.shift_start_time} onChange={(e) => updateEmployee(employee, { shift_start_time: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2" /></td>
                  <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${employee.is_active ? 'bg-success-bg text-success-text' : 'bg-gray-100 text-gray-500'}`}>{employee.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-5 py-4 text-right"><button onClick={() => updateEmployee(employee, { is_active: !employee.is_active })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold hover:bg-gray-50">{employee.is_active ? 'Deactivate' : 'Activate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-gray-100 md:hidden">
          {employees.map((employee) => (
            <div key={employee.id} className="p-4">
              <div className="font-bold text-gray-900">{employee.name}</div>
              <div className="text-sm text-gray-500">{employee.email}</div>
              <div className="mt-1 text-sm font-medium text-gray-600">{employee.department_name || 'Unassigned'}</div>
              <div className="mt-3 flex items-center justify-between">
                <input type="time" value={employee.shift_start_time} onChange={(e) => updateEmployee(employee, { shift_start_time: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2" />
                <button onClick={() => updateEmployee(employee, { is_active: !employee.is_active })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold">{employee.is_active ? 'Deactivate' : 'Activate'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
