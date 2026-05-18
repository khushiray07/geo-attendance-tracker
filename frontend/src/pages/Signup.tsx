import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Mail, MapPin, User, KeyRound, Lock } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
    inviteCode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/signup', { ...form, mode });
      login(data.token, data.user);
      navigate(data.user.role === 'admin' ? '/admin/settings' : '/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not create your account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Link to="/" className="mb-8 flex items-center gap-2 font-bold text-gray-950">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-white"><MapPin size={22} /></span>
          Geo Attendance Tracker
        </Link>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/50 sm:p-8">
          <h1 className="text-3xl font-black text-gray-950">Create your account</h1>
          <p className="mt-2 text-gray-600">Start a new organization as an admin or join your team with an invite code.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
            <button onClick={() => setMode('create')} className={`rounded-md px-3 py-2 text-sm font-bold ${mode === 'create' ? 'bg-white text-brand shadow-sm' : 'text-gray-600'}`}>
              Create organization
            </button>
            <button onClick={() => setMode('join')} className={`rounded-md px-3 py-2 text-sm font-bold ${mode === 'join' ? 'bg-white text-brand shadow-sm' : 'text-gray-600'}`}>
              Join organization
            </button>
          </div>

          {error && <div className="mt-5 rounded-lg border border-red-200 bg-danger-bg px-4 py-3 text-sm font-medium text-danger-text">{error}</div>}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field icon={<User size={18} />} label="Name" value={form.name} onChange={(value) => update('name', value)} placeholder="Your full name" />
            <Field icon={<Mail size={18} />} label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} placeholder="name@company.com" />
            <Field icon={<Lock size={18} />} label="Password" type="password" value={form.password} onChange={(value) => update('password', value)} placeholder="At least 8 characters" />
            <Field icon={<Lock size={18} />} label="Confirm password" type="password" value={form.confirmPassword} onChange={(value) => update('confirmPassword', value)} placeholder="Repeat password" />

            {mode === 'create' ? (
              <Field icon={<Building2 size={18} />} label="Organization name" value={form.organizationName} onChange={(value) => update('organizationName', value)} placeholder="Acme Operations" />
            ) : (
              <Field icon={<KeyRound size={18} />} label="Invite code" value={form.inviteCode} onChange={(value) => update('inviteCode', value.toUpperCase())} placeholder="TEAM42" />
            )}

            <button disabled={loading} className="w-full rounded-lg bg-brand px-4 py-3.5 font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Creating account...' : mode === 'create' ? 'Create organization' : 'Join organization'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account? <Link className="font-bold text-brand" to="/login">Login</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = 'text'
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-gray-700">{label}</span>
      <span className="relative block">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">{icon}</span>
        <input
          required
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-transparent bg-[#F4F7FE] py-3 pl-10 pr-3 text-gray-950 outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand-light"
        />
      </span>
    </label>
  );
}
