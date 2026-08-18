import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface PasswordResetRequest {
  id: string;
  user_id: string;
  status: string;
  requested_at: string;
  reset_token: string;
  user?: {
    username: string;
    employee?: {
      nama_lengkap: string;
      nip: string;
    };
  };
}

export function PasswordResetApproval() {
  const { user: superAdmin } = useAuth();
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('password_reset_requests')
        .select(`
          *,
          user:users(
            username,
            employee:employees(nama_lengkap, nip)
          )
        `)
        .in('status', ['pending', 'approved', 'rejected'])
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      console.error('Error fetching requests:', error);
      toast.error('Gagal memuat data permintaan');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    if (!newPassword || !confirmPassword) {
      toast.error('Password baru harus diisi');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Password tidak cocok');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    setProcessingId(selectedRequest.id);

    try {
      // Update password reset request status
      const { error: updateError } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: superAdmin?.id,
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      // Update password via edge function (syncs to auth account)
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'update_password',
          userId: selectedRequest.user_id,
          newPassword,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal mereset password');
      }

      toast.success('Password berhasil direset');
      setSelectedRequest(null);
      setNewPassword('');
      setConfirmPassword('');
      fetchRequests();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast.error(error.message || 'Gagal menyetujui permintaan');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Alasan penolakan harus diisi');
      return;
    }

    setProcessingId(requestId);

    try {
      const { error } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          approved_by: superAdmin?.id,
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Permintaan berhasil ditolak');
      setSelectedRequest(null);
      setRejectionReason('');
      fetchRequests();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast.error(error.message || 'Gagal menolak permintaan');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Persetujuan Reset Password</h1>
        <p className="text-gray-600 mt-1">Kelola permintaan reset password dari admin dan pengguna</p>
      </div>

      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700">
            <span className="font-medium">Ada {pendingRequests.length} permintaan menunggu persetujuan</span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requests List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Memuat data...</div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center">
                <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Tidak ada permintaan reset password</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedRequest?.id === request.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {getStatusIcon(request.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {request.user?.employee?.nama_lengkap || request.user?.username}
                            </p>
                            <p className="text-sm text-gray-600">
                              {request.user?.employee?.nip || request.user?.username}
                            </p>
                          </div>
                          <span
                            className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                              request.status
                            )}`}
                          >
                            {request.status === 'pending'
                              ? 'Menunggu'
                              : request.status === 'approved'
                              ? 'Disetujui'
                              : 'Ditolak'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {format(new Date(request.requested_at), 'dd MMM yyyy HH:mm', { locale: id })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div>
          {selectedRequest ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Detail Permintaan</h3>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Nama Lengkap</p>
                  <p className="font-medium text-gray-900">
                    {selectedRequest.user?.employee?.nama_lengkap || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">NIP</p>
                  <p className="font-medium text-gray-900">
                    {selectedRequest.user?.employee?.nip || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Username</p>
                  <p className="font-medium text-gray-900">{selectedRequest.user?.username}</p>
                </div>
                <div>
                  <p className="text-gray-600">Tanggal Permintaan</p>
                  <p className="font-medium text-gray-900">
                    {format(new Date(selectedRequest.requested_at), 'dd MMM yyyy HH:mm', { locale: id })}
                  </p>
                </div>
              </div>

              {selectedRequest.status === 'pending' && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password Baru
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Masukkan password baru"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Konfirmasi Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Konfirmasi password baru"
                    />
                  </div>

                  <button
                    onClick={handleApprove}
                    disabled={processingId === selectedRequest.id}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {processingId === selectedRequest.id ? 'Memproses...' : 'Setujui & Reset'}
                  </button>

                  <div className="space-y-2 pt-4 border-t">
                    <label className="block text-sm font-medium text-gray-700">
                      Atau Tolak Permintaan
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Alasan penolakan..."
                      rows={2}
                    />
                    <button
                      onClick={() => handleReject(selectedRequest.id)}
                      disabled={processingId === selectedRequest.id}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      {processingId === selectedRequest.id ? 'Memproses...' : 'Tolak'}
                    </button>
                  </div>
                </div>
              )}

              {selectedRequest.status === 'approved' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Disetujui</span> - Password telah direset
                  </p>
                </div>
              )}

              {selectedRequest.status === 'rejected' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-medium text-red-700 mb-1">Alasan Penolakan:</p>
                  <p className="text-sm text-red-700">{selectedRequest.user?.username}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
              <Lock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Pilih permintaan untuk melihat detail</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
