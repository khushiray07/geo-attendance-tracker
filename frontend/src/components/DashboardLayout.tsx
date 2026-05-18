import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, FileText, Activity, Settings, Bell, Menu, Users, UserCircle, CalendarDays } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const employeeLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'History', path: '/history', icon: <FileText size={20} /> },
    { name: 'Profile', path: '/profile', icon: <UserCircle size={20} /> },
  ];

  const adminLinks = [
    { name: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={20} /> },
    { name: 'Employees', path: '/admin/employees', icon: <Users size={20} /> },
    { name: 'Calendar', path: '/admin/calendar', icon: <CalendarDays size={20} /> },
    { name: 'Reports', path: '/admin/reports', icon: <FileText size={20} /> },
    { name: 'Logs', path: '/admin/logs', icon: <Activity size={20} /> },
    { name: 'Settings', path: '/admin/settings', icon: <Settings size={20} /> },
    { name: 'Profile', path: '/profile', icon: <UserCircle size={20} /> },
  ];

  const links = isAdmin ? adminLinks : employeeLinks;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:flex lg:flex-col ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <Link to={isAdmin ? '/admin' : '/dashboard'} className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-light">
            <img src="/geomark-logo.svg" alt="GeoMark" className="h-20 w-44 object-contain object-left" />
          </Link>
          <div className="flex items-center gap-3 mt-6 p-3 rounded-xl bg-gray-100">
            <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center font-bold">
              {isAdmin ? 'A' : 'E'}
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900">{isAdmin ? 'Admin Panel' : 'Employee Portal'}</div>
              <div className="text-xs text-gray-500">{user?.organization?.name || 'Organization'}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
          {links.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isActive 
                    ? 'bg-brand-light text-brand' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {link.icon} {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-background border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden text-gray-500 hover:text-gray-700"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-gray-500 hover:text-gray-700 relative">
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-sm font-bold">
                {user?.name.charAt(0)}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.name}</span>
            </div>
            {!isAdmin && (
              <button onClick={handleLogout} className="ml-2 text-gray-500 hover:text-red-600 lg:hidden">
                 <LogOut size={20} />
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
