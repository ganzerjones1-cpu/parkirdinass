import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Employee } from '../../types/database';
import { Plus, Search, Edit, Trash2, X, User, AlertTriangle, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    nip: '',
    nama_lengkap: '',
    jabatan_pangkat: '',
    no_kontak_wa: '',
    password: '',
  });
  const [showPasswordField, setShowPasswordField] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Gagal memuat data pegawai');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedEmployee) {
        const { password, ...empFields } = formData;
        const { error } = await supabase
          .from('employees')
          .update({
            ...empFields,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedEmployee.id);

        if (error) throw error;

        // Update password if a new one was entered
        if (password && selectedEmployee.user_id) {
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
          const session = await supabase.auth.getSession();
          const pwdResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.data.session?.access_token}`,
            },
            body: JSON.stringify({
              action: 'update_pegawai_password',
              userId: selectedEmployee.user_id,
              newPassword: password,
            }),
          });
          if (!pwdResponse.ok) {
            const err = await pwdResponse.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal memperbarui password');
          }
        }

        toast.success('Pegawai berhasil diperbarui');
      } else {
        // Create employee first
        const { password, ...empFields } = formData;
        const { data: empData, error } = await supabase
          .from('employees')
          .insert(empFields)
          .select('id')
          .maybeSingle();

        if (error) throw error;

        // Create user account if password provided
        if (password && empData) {
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
          const session = await supabase.auth.getSession();
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.data.session?.access_token}`,
            },
            body: JSON.stringify({
              action: 'create_pegawai_user',
              username: formData.nip,
              password,
              namaLengkap: formData.nama_lengkap,
            }),
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal membuat akun pengguna');
          }

          const result = await response.json();
          if (result.userId) {
            await supabase
              .from('employees')
              .update({ user_id: result.userId })
              .eq('id', empData.id);
          }
        }

        toast.success('Pegawai berhasil ditambahkan');
      }

      setShowModal(false);
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast.error(error.message || 'Gagal menyimpan pegawai');
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;

    try {
      const { error } = await supabase
        .from('employees')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedEmployee.id);

      if (error) throw error;
      toast.success('Pegawai berhasil dihapus (soft delete)');
      setShowDeleteModal(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Gagal menghapus pegawai');
    }
  };

  const resetForm = () => {
    setFormData({
      nip: '',
      nama_lengkap: '',
      jabatan_pangkat: '',
      no_kontak_wa: '',
      password: '',
    });
    setShowPasswordField(false);
    setSelectedEmployee(null);
  };

  const openEditModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      nip: employee.nip,
      nama_lengkap: employee.nama_lengkap,
      jabatan_pangkat: employee.jabatan_pangkat,
      no_kontak_wa: employee.no_kontak_wa || '',
      password: '',
    });
    setShowPasswordField(false);
    setShowModal(true);
  };

  const openDeleteModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.nip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.jabatan_pangkat.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Pegawai</h1>
          <p className="text-gray-600 mt-1">Kelola data sopir dan pegawai</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Tambah Pegawai
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari NIP, nama, atau jabatan..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Pegawai
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                  NIP
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                  Jabatan / Pangkat
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                  No. WA
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Tidak ada data pegawai
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="font-medium text-gray-900">{employee.nama_lengkap}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">
                      {employee.nip}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                      {employee.jabatan_pangkat}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">
                      {employee.no_kontak_wa || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(employee)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(employee)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowModal(false)}
            />
            <div className="inline-block w-full max-w-lg p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedEmployee ? 'Edit Pegawai' : 'Tambah Pegawai Baru'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIP *</label>
                  <input
                    type="text"
                    value={formData.nip}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="198001011"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    value={formData.nama_lengkap}
                    onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jabatan / Pangkat *</label>
                  <input
                    type="text"
                    value={formData.jabatan_pangkat}
                    onChange={(e) => setFormData({ ...formData, jabatan_pangkat: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Sopir / Staf"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No. WhatsApp</label>
                  <input
                    type="text"
                    value={formData.no_kontak_wa}
                    onChange={(e) => setFormData({ ...formData, no_kontak_wa: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="08123456789"
                  />
                </div>

                {/* Account section */}
                <div className="pt-4 border-t border-gray-200">
                  {!showPasswordField && !selectedEmployee && (
                    <button
                      type="button"
                      onClick={() => setShowPasswordField(true)}
                      className="w-full px-4 py-2.5 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors flex items-center justify-center gap-2 border border-green-200"
                    >
                      <Lock className="w-4 h-4" />
                      Buat Akun Login untuk Sopir
                    </button>
                  )}

                  {(showPasswordField || selectedEmployee) && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {selectedEmployee ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password Akun *'}
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Minimal 6 karakter"
                      />
                      <p className="text-xs text-gray-500">
                        {selectedEmployee
                          ? 'Username mengikuti NIP yang ada. Isi hanya untuk mengganti password.'
                          : 'Username otomatis menggunakan NIP. Sopir dapat login dengan NIP dan password ini.'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    {selectedEmployee ? 'Simpan Perubahan' : 'Tambah Pegawai'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowDeleteModal(false)}
            />
            <div className="inline-block w-full max-w-md p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus Pegawai?</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Apakah Anda yakin ingin menghapus{' '}
                  <span className="font-semibold">{selectedEmployee?.nama_lengkap}</span>?
                </p>
                <p className="text-xs text-gray-500 mb-6">
                  Tindakan ini akan menonaktifkan fungsi scan QR terkait. Data akan di-soft delete.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
