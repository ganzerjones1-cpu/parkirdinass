import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { User, Edit2, Save, X, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserWithEmployee {
  id: string;
  username: string;
  password: string;
  role: string;
  employee?: {
    id: string;
    nip: string;
    nama_lengkap: string;
  };
}

export function UserManagement() {
  const { user: superAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<UserWithEmployee>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          username,
          password,
          role,
          employee:employees(id, nip, nama_lengkap)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Gagal memuat data pengguna');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: UserWithEmployee) => {
    setEditingId(user.id);
    setEditData({
      username: user.username,
      password: user.password,
      ...user.employee,
    });
  };

  const handleSave = async (userId: string) => {
    if (!editData.username || !editData.password) {
      toast.error('Username dan Password tidak boleh kosong');
      return;
    }

    if (editData.password.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'update_username',
          userId,
          newUsername: editData.username,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal memperbarui username');
      }

      const pwdResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'update_password',
          userId,
          newPassword: editData.password,
        }),
      });

      if (!pwdResponse.ok) {
        const err = await pwdResponse.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal memperbarui password');
      }

      // Update employee if exists
      const user = users.find(u => u.id === userId);
      if (user?.employee && user.employee.id) {
        const { error: empError } = await supabase
          .from('employees')
          .update({
            nama_lengkap: editData.nama_lengkap,
            nip: editData.nip,
          })
          .eq('id', user.employee.id);

        if (empError) {
          console.warn('Warning updating employee:', empError);
        }
      }

      toast.success('Data pengguna berhasil diperbarui');
      setEditingId(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error(error.message || 'Gagal menyimpan data');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin_parkir':
        return 'Admin Parkir';
      case 'user_pegawai':
        return 'Pegawai/Sopir';
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-700';
      case 'admin_parkir':
        return 'bg-blue-100 text-blue-700';
      case 'user_pegawai':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manajemen User</h1>
        <p className="text-gray-600 mt-1">Kelola username, password, nama, dan NIP pengguna</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Memuat data pengguna...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Tidak ada pengguna</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Nama Lengkap</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">NIP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Password</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      {editingId === user.id ? (
                        <input
                          type="text"
                          value={editData.nama_lengkap || ''}
                          onChange={(e) => setEditData({ ...editData, nama_lengkap: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-900 font-medium">{user.employee?.nama_lengkap || '-'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === user.id ? (
                        <input
                          type="text"
                          value={editData.nip || ''}
                          onChange={(e) => setEditData({ ...editData, nip: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-600">{user.employee?.nip || '-'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === user.id ? (
                        <input
                          type="text"
                          value={editData.username || ''}
                          onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-900">{user.username}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === user.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            value={editData.password || ''}
                            onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <span className="text-xs text-gray-500">Min 6 karakter</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Lock className="w-4 h-4" />
                          <span>{'*'.repeat(Math.min(user.password.length, 6))}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {editingId === user.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSave(user.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Simpan"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Batal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <span className="font-medium">Catatan:</span> Setiap perubahan username dan password akan langsung tersinkronisasi dengan sistem login.
        </p>
      </div>
    </div>
  );
}
