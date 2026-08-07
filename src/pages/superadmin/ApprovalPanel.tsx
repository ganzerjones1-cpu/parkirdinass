import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Permit } from '../../types/database';
import { CheckCircle, XCircle, Clock, FileText, Calendar, User, Car, Eye, Trash2, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface PermitWithDetails extends Permit {
  employee: {
    id: string;
    nama_lengkap: string;
    nip: string;
    jabatan_pangkat: string;
  } | null;
  vehicle: {
    id: string;
    no_polisi: string;
    tipe_merk: string;
    nama_instansi: string;
  } | null;
}

export function ApprovalPanel() {
  const { user } = useAuth();
  const [permits, setPermits] = useState<PermitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState<PermitWithDetails | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchPermits();
  }, []);

  const fetchPermits = async () => {
    try {
      const { data, error } = await supabase
        .from('permits')
        .select(`
          *,
          employee:employees (*),
          vehicle:vehicles (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPermits((data || []) as unknown as PermitWithDetails[]);
    } catch (error) {
      console.error('Error fetching permits:', error);
      toast.error('Gagal memuat data permohonan');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (permitId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('permits')
        .update({
          status: 'Disetujui',
          approved_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', permitId);

      if (error) throw error;
      toast.success('Permohonan berhasil disetujui');
      fetchPermits();
    } catch (error) {
      console.error('Error approving permit:', error);
      toast.error('Gagal menyetujui permohonan');
    }
  };

  const handleReject = async () => {
    if (!user || !selectedPermit) return;

    try {
      const { error } = await supabase
        .from('permits')
        .update({
          status: 'Ditolak',
          approved_by: user.id,
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPermit.id);

      if (error) throw error;
      toast.success('Permohonan berhasil ditolak');
      setShowRejectModal(false);
      setSelectedPermit(null);
      setRejectionReason('');
      fetchPermits();
    } catch (error) {
      console.error('Error rejecting permit:', error);
      toast.error('Gagal menolak permohonan');
    }
  };

  const handleDelete = async () => {
    if (!selectedPermit) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('permits')
        .delete()
        .eq('id', selectedPermit.id);

      if (error) throw error;
      toast.success('Permohonan berhasil dihapus');
      setShowDeleteConfirm(false);
      setSelectedPermit(null);
      fetchPermits();
    } catch (error) {
      console.error('Error deleting permit:', error);
      toast.error('Gagal menghapus permohonan');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Disetujui': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'Ditolak': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Disetujui': return 'bg-green-100 text-green-700';
      case 'Ditolak': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const pendingPermits = permits.filter((p) => p.status === 'Menunggu');
  const processedPermits = permits.filter((p) => p.status !== 'Menunggu');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel Persetujuan Izin</h1>
        <p className="text-gray-600 mt-1">Tinjau dan setujui permohonan penggunaan kendaraan</p>
      </div>

      {/* Pending Permits */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-600" />
          Menunggu Persetujuan ({pendingPermits.length})
        </h2>
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
              Memuat data...
            </div>
          ) : pendingPermits.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
              Tidak ada permohonan yang menunggu
            </div>
          ) : (
            pendingPermits.map((permit) => (
              <div
                key={permit.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{permit.employee?.nama_lengkap}</p>
                        <p className="text-sm text-gray-600">NIP: {permit.employee?.nip}</p>
                        <p className="text-xs text-gray-500">{permit.employee?.jabatan_pangkat}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Car className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{permit.vehicle?.no_polisi}</p>
                        <p className="text-sm text-gray-600">{permit.vehicle?.tipe_merk}</p>
                        <p className="text-xs text-gray-500">{permit.vehicle?.nama_instansi}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Keperluan:</p>
                      <p className="text-sm text-gray-600">{permit.purpose}</p>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {format(new Date(permit.start_date), 'dd MMM yyyy HH:mm', { locale: id })} -{' '}
                        {format(new Date(permit.end_date), 'dd MMM yyyy HH:mm', { locale: id })}
                      </span>
                    </div>

                    {permit.spt_document_url && (
                      <a
                        href={permit.spt_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline mb-4"
                      >
                        <FileText className="w-4 h-4" />
                        Lihat Dokumen SPT
                      </a>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(permit.id)}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Setujui
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPermit(permit);
                          setShowRejectModal(true);
                        }}
                        className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Tolak
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Processed Permits */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Riwayat Persetujuan</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pemohon</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                    Kendaraan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">
                    Periode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {processedPermits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Tidak ada riwayat
                    </td>
                  </tr>
                ) : (
                  processedPermits.map((permit) => (
                    <tr key={permit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{permit.employee?.nama_lengkap}</p>
                        <p className="text-sm text-gray-600">{permit.employee?.nip}</p>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <p className="text-sm text-gray-900">{permit.vehicle?.no_polisi}</p>
                        <p className="text-xs text-gray-600">{permit.vehicle?.nama_instansi}</p>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-sm text-gray-600">
                        {format(new Date(permit.start_date), 'dd/MM', { locale: id })} -{' '}
                        {format(new Date(permit.end_date), 'dd/MM/yyyy', { locale: id })}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(permit.status)}`}
                        >
                          {permit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedPermit(permit);
                              setShowDetailModal(true);
                            }}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPermit(permit);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedPermit && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowRejectModal(false)}
            />
            <div className="inline-block w-full max-w-lg p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Tolak Permohonan</h3>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Pemohon:</span> {selectedPermit.employee?.nama_lengkap}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">Keperluan:</span> {selectedPermit.purpose}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alasan Penolakan *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Jelaskan alasan penolakan..."
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedPermit(null);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectionReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Tolak Permohonan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedPermit && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowDetailModal(false)}
            />
            <div className="inline-block w-full max-w-lg p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Detail Permohonan Izin</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  {getStatusIcon(selectedPermit.status)}
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedPermit.status)}`}>
                      {selectedPermit.status}
                    </span>
                  </div>
                </div>

                {/* Pemohon */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Pemohon</p>
                    <p className="font-medium text-gray-900">{selectedPermit.employee?.nama_lengkap}</p>
                    <p className="text-sm text-gray-600">NIP: {selectedPermit.employee?.nip}</p>
                    <p className="text-xs text-gray-500">{selectedPermit.employee?.jabatan_pangkat}</p>
                  </div>
                </div>

                {/* Kendaraan */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Car className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Kendaraan</p>
                    <p className="font-medium text-gray-900">{selectedPermit.vehicle?.no_polisi}</p>
                    <p className="text-sm text-gray-600">{selectedPermit.vehicle?.tipe_merk}</p>
                    <p className="text-xs text-gray-500">{selectedPermit.vehicle?.nama_instansi}</p>
                  </div>
                </div>

                {/* Periode */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Periode</p>
                    <p className="font-medium text-gray-900">
                      {format(new Date(selectedPermit.start_date), 'dd MMM yyyy, HH:mm', { locale: id })} -{' '}
                      {format(new Date(selectedPermit.end_date), 'dd MMM yyyy, HH:mm', { locale: id })}
                    </p>
                  </div>
                </div>

                {/* Keperluan */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Keperluan</p>
                  <p className="font-medium text-gray-900">{selectedPermit.purpose}</p>
                </div>

                {/* SPT Document */}
                {selectedPermit.spt_document_url && (
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Surat Perintah Tugas</p>
                      <a
                        href={selectedPermit.spt_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 underline font-medium"
                      >
                        Lihat Dokumen SPT
                      </a>
                    </div>
                  </div>
                )}

                {/* Rejection Reason */}
                {selectedPermit.rejection_reason && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-700 mb-1">Alasan Penolakan</p>
                    <p className="text-red-600">{selectedPermit.rejection_reason}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="text-xs text-gray-400 space-y-1 pt-2 border-t">
                  <p>Dibuat: {format(new Date(selectedPermit.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}</p>
                  <p>Diperbarui: {format(new Date(selectedPermit.updated_at), 'dd MMM yyyy, HH:mm', { locale: id })}</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedPermit && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => !deleting && setShowDeleteConfirm(false)}
            />
            <div className="inline-block w-full max-w-sm p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus Permohonan?</h3>
                <p className="text-sm text-gray-500 mb-2">
                  Permohonan izin dari <span className="font-medium text-gray-700">{selectedPermit.employee?.nama_lengkap}</span> akan dihapus secara permanen.
                </p>
                <p className="text-xs text-red-600 mb-6">Tindakan ini tidak dapat dibatalkan.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Menghapus...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
