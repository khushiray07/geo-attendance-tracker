import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Lazy loading views could be done, but importing directly for simplicity
import Login from './pages/Login';
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AttendanceHistory from './pages/AttendanceHistory';
import AdminDashboard from './pages/admin/AdminDashboard';
import OfficeSettings from './pages/admin/OfficeSettings';
import Reports from './pages/admin/Reports';
import AuditLogs from './pages/admin/AuditLogs';
import Employees from './pages/admin/Employees';
import EmployeeCalendar from './pages/admin/EmployeeCalendar';
import Profile from './pages/Profile';

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Landing />;
  if (user.role === 'admin') return <Navigate to="/admin" />;
  return <Navigate to="/dashboard" />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Employee Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['employee']}>
                <EmployeeDashboard />
              </ProtectedRoute>
            } />
            <Route path="/history" element={
              <ProtectedRoute allowedRoles={['employee']}>
                <AttendanceHistory />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <OfficeSettings />
              </ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/admin/employees" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Employees />
              </ProtectedRoute>
            } />
            <Route path="/admin/calendar" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <EmployeeCalendar />
              </ProtectedRoute>
            } />
            <Route path="/admin/logs" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AuditLogs />
              </ProtectedRoute>
            } />

            <Route path="/" element={<RootRedirect />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
