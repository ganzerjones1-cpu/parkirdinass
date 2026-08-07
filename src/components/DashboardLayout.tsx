import React, { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  Car,
  Users,
  FileText,
  QrCode,
  AlertTriangle,
  LogOut,
  Menu,
  X,
  User,
  ClipboardList,
  CheckCircle,
  Settings,
  Camera,
  ChevronDown,
  Lock,
  Eye,
  EyeOff,
  Calendar,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';

const menuItems = {
  user_pegawai: [
    { path: '/pegawai/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/pegawai/permit', label: 'E-Izin', icon: FileText },
    { path: '/pegawai/history', label: 'Riwayat', icon: ClipboardList },
  ],
  admin_parkir: [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/scan', label: 'Scan QR', icon: QrCode },
    { path: '/admin/vehicles', label: 'Kendaraan', icon: Car },
    { path: '/admin/employees', label: 'Pegawai', icon: Users },
    { path: '/admin/pairs', label: 'Paket QR', icon: QrCode },
    { path: '/admin/parking-report', label: 'Laporan Parkir', icon: FileText },
  ],
  super_admin: [
    { path: '/superadmin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/superadmin/approvals', label: 'Persetujuan Izin', icon: CheckCircle },
    { path: '/superadmin/reset-password', label: 'Reset Password', icon: Lock },
    { path: '/superadmin/violations', label: 'Daftar Merah', icon: AlertTriangle },
    { path: '/superadmin/parking-report', label: 'Laporan Parkir', icon: FileText },
    { path: '/superadmin/users', label: 'Manajemen User', icon: User },
  ],
};

function getDisplayName(userWithEmployee: ReturnType<typeof useAuth>['userWithEmployee']): string {
  if (!userWithEmployee) return '';
  return (
    userWithEmployee.employee?.nama_lengkap ||
    userWithEmployee.nama_lengkap ||
    userWithEmployee.username
  );
}

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { userWithEmployee, user, signOut, role, refreshUserData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    nama_lengkap: '',
    foto: '',
  });
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (userWithEmployee) {
      setFormData({
        username: userWithEmployee.username || '',
        password: '',
        confirmPassword: '',
        nama_lengkap:
          userWithEmployee.employee?.nama_lengkap ||
          userWithEmployee.nama_lengkap ||
          '',
        foto: userWithEmployee.foto || '',
      });
    }
  }, [userWithEmployee]);

  // Reset password visibility when modal closes
  useEffect(() => {
    if (!showProfileModal) {
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [showProfileModal]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 2MB');
      return;
    }

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setFormData(prev => ({ ...prev, foto: base64 }));
      setUploadingPhoto(false);
    };
    reader.onerror = () => {
      toast.error('Gagal membaca file');
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async () => {
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error('Password tidak cocok');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    setLoading(true);
    try {
      // Update users table — always save nama_lengkap here for all roles
      const updateData: {
        username: string;
        foto: string;
        nama_lengkap: string;
        password?: string;
      } = {
        username: formData.username,
        foto: formData.foto,
        nama_lengkap: formData.nama_lengkap,
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      const { error: userError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user!.id);

      if (userError) throw userError;

      // Also sync to employees table if the user has an employee record
      if (userWithEmployee?.employee && formData.nama_lengkap) {
        const { error: employeeError } = await supabase
          .from('employees')
          .update({ nama_lengkap: formData.nama_lengkap })
          .eq('id', userWithEmployee.employee.id);

        if (employeeError) throw employeeError;
      }

      toast.success('Profil berhasil diperbarui');
      setShowProfileModal(false);
      await refreshUserData();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Gagal memperbarui profil');
    } finally {
      setLoading(false);
    }
  };

  const currentMenu = role ? menuItems[role] || [] : [];

  const getRoleLabel = () => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'admin_parkir': return 'Admin Parkir';
      case 'user_pegawai': return 'Pegawai/Sopir';
      default: return '';
    }
  };

  const getRoleColor = () => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-700';
      case 'admin_parkir': return 'bg-blue-100 text-blue-700';
      case 'user_pegawai': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const displayName = getDisplayName(userWithEmployee);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <img src="/logo-login.png" alt="Logo TTU" className="w-10 h-10 object-cover" />
              <div>
                <h1 className="font-bold text-gray-900">GARASI</h1>
                <p className="text-xs text-gray-500">Kab. TTU</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User info */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                {userWithEmployee?.foto ? (
                  <img src={userWithEmployee.foto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                <p className="text-xs text-gray-500 truncate">
                  {userWithEmployee?.employee?.nip || userWithEmployee?.username}
                </p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${getRoleColor()}`}>
                  {getRoleLabel()}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {currentMenu.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sign out */}
          <div className="px-4 py-4 border-t">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex-1 lg:hidden text-center">
              <h1 className="font-semibold text-gray-900">GARASI</h1>
            </div>
            <div className="hidden lg:block">
              <h2 className="text-lg font-semibold text-gray-900">
                {currentMenu.find((item) => item.path === location.pathname)?.label || 'Dashboard'}
              </h2>
            </div>

            {/* Profile Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                  {userWithEmployee?.foto ? (
                    <img src={userWithEmployee.foto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-gray-600" />
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-600" />
              </button>

              {/* Dropdown Menu */}
              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{displayName}</p>
                    <p className="text-xs text-gray-500">
                      {userWithEmployee?.employee?.nip || userWithEmployee?.username}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowProfileModal(true);
                      setProfileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">Edit Profil</span>
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Keluar</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Profile Edit Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">Edit Profil</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Photo */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-32 h-32 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                    {formData.foto ? (
                      <img src={formData.foto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-gray-600" />
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Klik ikon kamera untuk mengubah foto</p>
              </div>

              {/* Username/NIP */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username / NIP
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Masukkan username atau NIP"
                />
              </div>

              {/* Nama Lengkap */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={formData.nama_lengkap}
                  onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Masukkan nama lengkap"
                />
              </div>

              {/* Password Baru */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password Baru <span className="text-gray-400 font-normal">(kosongkan jika tidak ingin mengubah)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Masukkan password baru"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Konfirmasi Password */}
              {formData.password && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Konfirmasi Password Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Konfirmasi password baru"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t bg-gray-50 sticky bottom-0">
              <button
                onClick={() => setShowProfileModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleUpdateProfile}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
