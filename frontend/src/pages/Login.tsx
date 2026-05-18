import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Lock, Mail, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Login() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const showDemo = params.get('demo') === '1';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.token, data.user);
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const tryDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1fr_440px]">
        <section className="hidden lg:block">
          <Link to="/" className="mb-10 flex items-center gap-2 font-bold text-gray-950">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-white"><MapPin size={22} /></span>
            Geo Attendance Tracker
          </Link>
          <h1 className="max-w-xl text-5xl font-black leading-tight text-gray-950">Sign in to manage verified attendance.</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-gray-600">
            Real users can create organizations, invite employees, configure geofences, and export attendance reports.
          </p>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/50 sm:p-8">
          <Link to="/" className="mb-8 flex items-center gap-2 font-bold text-gray-950 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-white"><MapPin size={22} /></span>
            Geo Attendance Tracker
          </Link>
          <h2 className="text-3xl font-black text-gray-950">Login</h2>
          <p className="mt-2 text-gray-600">Use your organization account to continue.</p>

          {error && <div className="mt-5 rounded-lg border border-red-200 bg-danger-bg px-4 py-3 text-sm font-medium text-danger-text">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-700">Email</span>
              <span className="relative block">
                <Mail className="absolute left-3 top-3.5 text-gray-400" size={18} />
                <input className="w-full rounded-lg border border-transparent bg-[#F4F7FE] py-3 pl-10 pr-3 outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand-light" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-700">Password</span>
              <span className="relative block">
                <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
                <input className="w-full rounded-lg border border-transparent bg-[#F4F7FE] py-3 pl-10 pr-3 outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand-light" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
              </span>
            </label>
            <button disabled={loading} className="w-full rounded-lg bg-brand px-4 py-3.5 font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-600">
            New to Geo Attendance Tracker? <Link className="font-bold text-brand" to="/signup">Create account</Link>
          </p>

          <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-700">Demo Access</h3>
              {!showDemo && <Link to="/login?demo=1" className="text-xs font-bold text-brand">Try demo</Link>}
            </div>
            <div className="grid gap-2">
              <DemoButton label="Try demo admin" email="admin@demo.com" onClick={tryDemo} />
              <DemoButton label="Try demo employee" email="employee@demo.com" onClick={tryDemo} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DemoButton({ label, email, onClick }: { label: string; email: string; onClick: (email: string) => void }) {
  return (
    <button onClick={() => onClick(email)} className="flex items-center justify-between rounded-lg bg-white px-3 py-3 text-left text-sm hover:ring-2 hover:ring-brand-light">
      <span>
        <span className="block font-bold text-gray-900">{label}</span>
        <span className="text-xs text-gray-500">{email} / password123</span>
      </span>
      <Copy size={16} className="text-brand" />
    </button>
  );
}
