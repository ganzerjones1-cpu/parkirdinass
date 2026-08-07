import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { ForgotPasswordPage } from './components/ForgotPasswordPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './components/DashboardLayout';
import { PegawaiDashboard } from './pages/pegawai/PegawaiDashboard';
import { PegawaiPermit } from './pages/pegawai/PegawaiPermit';
import { PegawaiHistory } from './pages/pegawai/PegawaiHistory';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminScan } from './pages/admin/AdminScan';
import { VehicleManagement } from './pages/admin/VehicleManagement';
import { EmployeeManagement } from './pages/admin/EmployeeManagement';
import { PairManagement } from './pages/admin/PairManagement';
import { Reports } from './pages/admin/Reports';
import { ParkingReport } from './pages/admin/ParkingReport';
import { ApprovalPanel } from './pages/superadmin/ApprovalPanel';
import { ViolationList } from './pages/superadmin/ViolationList';
import { UserManagement } from './pages/superadmin/UserManagement';
import { PasswordResetApproval } from './pages/superadmin/PasswordResetApproval';
import { Toaster } from 'react-hot-toast';

function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Akses Ditolak</h1>
        <p className="text-gray-600 mb-4">Anda tidak memiliki akses ke halaman ini.</p>
        <a href="/login" className="text-blue-600 hover:underline">Kembali ke Login</a>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  const getDashboardPath = () => {
    switch (role) {
      case 'super_admin':
        return '/superadmin/dashboard';
      case 'admin_parkir':
        return '/admin/dashboard';
      case 'user_pegawai':
        return '/pegawai/dashboard';
      default:
        return '/login';
    }
  };

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={user ? <Navigate to={getDashboardPath()} replace /> : <LoginPage />}
      />
      <Route
        path="/forgot-password"
        element={user ? <Navigate to={getDashboardPath()} replace /> : <ForgotPasswordPage />}
      />

      {/* Unauthorized page */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Pegawai routes */}
      <Route
        path="/pegawai"
        element={
          <ProtectedRoute allowedRoles={['user_pegawai']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/pegawai/dashboard" replace />} />
        <Route path="dashboard" element={<PegawaiDashboard />} />
        <Route path="permit" element={<PegawaiPermit />} />
        <Route path="history" element={<PegawaiHistory />} />
      </Route>

      {/* Admin Parkir routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin_parkir']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="scan" element={<AdminScan />} />
        <Route path="vehicles" element={<VehicleManagement />} />
        <Route path="employees" element={<EmployeeManagement />} />
        <Route path="pairs" element={<PairManagement />} />
        <Route path="reports" element={<Reports />} />
        <Route path="parking-report" element={<ParkingReport />} />
      </Route>

      {/* Super Admin routes */}
      <Route
        path="/superadmin"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
        <Route path="dashboard" element={<ApprovalPanel />} />
        <Route path="approvals" element={<ApprovalPanel />} />
        <Route path="reset-password" element={<PasswordResetApproval />} />
        <Route path="violations" element={<ViolationList />} />
        <Route path="vehicles" element={<VehicleManagement />} />
        <Route path="employees" element={<EmployeeManagement />} />
        <Route path="pairs" element={<PairManagement />} />
        <Route path="reports" element={<Reports />} />
        <Route path="parking-report" element={<ParkingReport />} />
        <Route path="users" element={<UserManagement />} />
      </Route>

      {/* Redirect root — to dashboard if logged in, otherwise login */}
      <Route path="/" element={<Navigate to={user ? getDashboardPath() : '/login'} replace />} />

      {/* 404 - Redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </AuthProvider>
    </Router>
  );
}

export default App;
