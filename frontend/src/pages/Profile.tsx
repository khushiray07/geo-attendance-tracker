import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { Mail, Shield, Building2, Clock, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <DashboardLayout title="Profile">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="mt-2 text-gray-500">Your account and organization details.</p>
      </div>

      <div className="max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-brand text-2xl font-black text-white">{user?.name?.charAt(0)}</div>
          <div>
            <div className="text-2xl font-black text-gray-950">{user?.name}</div>
            <div className="text-sm capitalize text-gray-500">{user?.role}</div>
          </div>
        </div>

        <div className="grid gap-3">
          <Info icon={<Mail size={18} />} label="Email" value={user?.email || ''} />
          <Info icon={<Building2 size={18} />} label="Organization" value={user?.organization?.name || 'Not assigned'} />
          <Info icon={<Shield size={18} />} label="Role" value={user?.role || ''} />
          <Info icon={<Clock size={18} />} label="Shift start" value={user?.shift_start_time || '09:00'} />
        </div>

        <button onClick={handleLogout} className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-bold text-white hover:bg-blue-700">
          <LogOut size={18} /> Logout
        </button>
      </div>
    </DashboardLayout>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#F4F7FE] p-4">
      <div className="text-brand">{icon}</div>
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</div>
        <div className="font-bold text-gray-900">{value}</div>
      </div>
    </div>
  );
}
