import { Link } from 'react-router-dom';
import { Activity, BarChart3, Clock, FileText, MapPin, ShieldCheck } from 'lucide-react';
import hero from '../assets/hero.png';

const features = [
  { icon: <MapPin size={20} />, title: 'GPS attendance', text: 'Employees check in and out from their browser with location permission.' },
  { icon: <ShieldCheck size={20} />, title: 'Office geofence', text: 'Backend validation confirms every punch is inside the configured office radius.' },
  { icon: <Clock size={20} />, title: 'Working hours', text: 'Check-out calculates work duration and missing checkouts automatically.' },
  { icon: <Activity size={20} />, title: 'Late detection', text: 'Shift start and grace threshold flag late arrivals consistently.' },
  { icon: <BarChart3 size={20} />, title: 'Admin dashboard', text: 'See present staff, late arrivals, employee status, and organization settings.' },
  { icon: <FileText size={20} />, title: 'Reports and logs', text: 'Export monthly CSV reports and audit accepted or rejected location attempts.' },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-background text-gray-950">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2 font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-white">
            <MapPin size={22} />
          </span>
          Geo Attendance Tracker
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="rounded-lg px-4 py-2 text-sm font-bold text-gray-700 hover:bg-white">Login</Link>
          <Link to="/signup" className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700">Get Started</Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:py-16">
        <div>
          <p className="mb-4 inline-flex rounded-full bg-brand-light px-3 py-1 text-sm font-bold text-brand">Built for real teams, not just demos</p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
            Geo Attendance Tracker
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-600">
            Run location-verified attendance for your organization with invite-code onboarding, office geofencing, late arrival tracking, reports, and audit logs.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup" className="inline-flex items-center justify-center rounded-lg bg-brand px-6 py-3 font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700">
              Get Started
            </Link>
            <Link to="/login" className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-3 font-bold text-gray-800 hover:border-brand hover:text-brand">
              Login
            </Link>
            <Link to="/login?demo=1" className="inline-flex items-center justify-center rounded-lg px-6 py-3 font-bold text-gray-600 hover:bg-white">
              Try Demo
            </Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl shadow-gray-200/60">
          <img src={hero} alt="Geo attendance dashboard preview" className="h-full w-full object-cover" />
        </div>
      </section>

      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-lg border border-gray-200 p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand">{feature.icon}</div>
              <h2 className="font-bold text-gray-950">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
