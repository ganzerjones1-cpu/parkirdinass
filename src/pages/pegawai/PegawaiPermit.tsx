import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Permit, Vehicle } from '../../types/database';
import { Plus, FileText, CheckCircle, XCircle, Clock, Calendar, Upload, X, Eye, Trash2, Car, AlertTriangle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface PermitWithVehicle extends Permit {
  vehicle: Vehicle | null;
}

export function PegawaiPermit() {
  const { userWithEmployee } = useAuth();
  const [permits, setPermits] = useState<PermitWithVehicle[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState<PermitWithVehicle | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    purpose: '',
    vehicle_id: '',
    spt_file: null as File | null,
  });
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [userWithEmployee]);

  const fetchData = async () => {
    if (!userWithEmployee?.employee?.id) return;

    try {
      // Fetch user's permits
      const { data: permitData, error: permitError } = await supabase
        .from('permits')
        .select(`
          *,
          vehicle:vehicles (*)
        `)
        .eq('employee_id', userWithEmployee.employee.id)
        .order('created_at', { ascending: false });

      if (permitError) throw permitError;
      setPermits((permitData || []) as unknown as PermitWithVehicle[]);

      // Fetch available vehicles (those paired with this employee)
      const { data: pairsData, error: pairsError } = await supabase
        .from('vehicle_driver_pairs')
        .select(`
          vehicle:vehicles (*)
        `)
        .eq('employee_id', userWithEmployee.employee.id)
        .is('deleted_at', null);

      if (pairsError) throw pairsError;

      const vehicleList = pairsData?.map(p => p.vehicle).filter(Boolean) || [];
      setVehicles(vehicleList as unknown as Vehicle[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userWithEmployee?.employee?.id) {
      toast.error('Data pegawai tidak ditemukan');
      return;
    }

    try {
      let sptUrl = null;

      // Upload SPT file if provided
      if (formData.spt_file) {
        setUploadingFile(true);
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.spt_file);

        // First create permit to get ID, then upload with permit ID
        const { data: permitData, error: permitError } = await supabase.from('permits').insert({
          employee_id: userWithEmployee.employee.id,
          vehicle_id: formData.vehicle_id,
          start_date: new Date(formData.start_date).toISOString(),
          end_date: new Date(formData.end_date).toISOString(),
          purpose: formData.purpose,
          status: 'Menunggu',
        }).select();

        if (permitError) throw permitError;

        const permitId = permitData[0].id;
        uploadFormData.append('permitId', permitId);

        const uploadResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-spt`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: uploadFormData,
          }
        );

        if (!uploadResponse.ok) {
          throw new Error('Gagal upload SPT');
        }

        const uploadData = await uploadResponse.json();
        sptUrl = uploadData.url;

        // Update permit with SPT URL
        await supabase
          .from('permits')
          .update({ spt_document_url: sptUrl })
          .eq('id', permitId);
      } else {
        // Create permit without SPT
        const { error } = await supabase.from('permits').insert({
          employee_id: userWithEmployee.employee.id,
          vehicle_id: formData.vehicle_id,
          start_date: new Date(formData.start_date).toISOString(),
          end_date: new Date(formData.end_date).toISOString(),
          purpose: formData.purpose,
          status: 'Menunggu',
        });

        if (error) throw error;
      }

      toast.success('Permohonan izin berhasil diajukan');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error submitting permit:', error);
      toast.error(error.message || 'Gagal mengajukan permohonan');
    } finally {
      setUploadingFile(false);
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

      toast.success('Permohonan izin berhasil dihapus');
      setShowDeleteConfirm(false);
      setSelectedPermit(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting permit:', error);
      toast.error('Gagal menghapus permohonan');
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      start_date: '',
      end_date: '',
      purpose: '',
      vehicle_id: '',
      spt_file: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Format file hanya PDF, JPG, atau PNG');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 10MB');
      return;
    }

    setFormData({ ...formData, spt_file: file });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Disetujui':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'Ditolak':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Disetujui':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'Ditolak':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const canDelete = (permit: Permit) => {
    return permit.status === 'Menunggu';
  };

  if (!userWithEmployee?.employee?.id) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800">Data Pegawai Belum Lengkap</h3>
              <p className="text-yellow-700 text-sm mt-1">
                Akun Anda belum dikaitkan dengan data pegawai. Silakan hubungi Admin Parkir untuk melengkapi data Anda.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Izin</h1>
          <p className="text-gray-600 mt-1">Ajukan permohonan izin penggunaan kendaraan di luar jam dinas</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Ajukan Izin
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Memuat data...</div>
          ) : permits.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Belum ada permohonan izin</p>
            </div>
          ) : (
            permits.map((permit) => (
              <div key={permit.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {getStatusIcon(permit.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">{permit.purpose}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {permit.vehicle?.no_polisi} - {permit.vehicle?.nama_instansi}
                        </p>
                      </div>
                      <span
                        className={`inline-flex px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(
                          permit.status
                        )}`}
                      >
                        {permit.status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {format(new Date(permit.start_date), 'dd MMM yyyy', { locale: id })} -{' '}
                          {format(new Date(permit.end_date), 'dd MMM yyyy', { locale: id })}
                        </span>
                      </div>
                    </div>
                    {permit.spt_document_url && (
                      <div className="mt-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <a
                          href={permit.spt_document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 underline"
                        >
                          Lihat SPT
                        </a>
                      </div>
                    )}
                    {permit.rejection_reason && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">
                          <span className="font-medium">Alasan Penolakan:</span> {permit.rejection_reason}
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedPermit(permit);
                        setShowDetailModal(true);
                      }}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Lihat Detail"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {canDelete(permit) && (
                      <button
                        onClick={() => {
                          setSelectedPermit(permit);
                          setShowDeleteConfirm(true);
                        }}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Permit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowModal(false)}
            />
            <div className="inline-block w-full max-w-lg p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Ajukan Permohonan Izin</h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kendaraan *</label>
                  <select
                    value={formData.vehicle_id}
                    onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Pilih Kendaraan</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.no_polisi} - {vehicle.nama_instansi}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai *</label>
                    <input
                      type="datetime-local"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Selesai *</label>
                    <input
                      type="datetime-local"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keperluan *</label>
                  <textarea
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Jelaskan keperluan penggunaan kendaraan..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Surat Perintah Tugas (SPT)</label>
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-5 h-5 text-gray-400" />
                      <div className="text-left">
                        {formData.spt_file ? (
                          <>
                            <p className="text-sm font-medium text-blue-600">{formData.spt_file.name}</p>
                            <p className="text-xs text-gray-500">Klik untuk mengubah file</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-gray-700">Pilih atau Drag & Drop</p>
                            <p className="text-xs text-gray-500">PDF, JPG, PNG (Max 10MB)</p>
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">SPT bersifat opsional. Anda bisa menambahkannya nanti.</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingFile}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingFile ? 'Mengunggah...' : 'Ajukan'}
                  </button>
                </div>
              </form>
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
                    <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(selectedPermit.status)}`}>
                      {selectedPermit.status}
                    </span>
                  </div>
                </div>

                {/* Kendaraan */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Car className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Kendaraan</p>
                    <p className="font-medium text-gray-900">
                      {selectedPermit.vehicle?.no_polisi || '-'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedPermit.vehicle?.nama_instansi || '-'}
                    </p>
                  </div>
                </div>

                {/* Tanggal */}
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
                {canDelete(selectedPermit) && (
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
                )}
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
                <p className="text-sm text-gray-500 mb-6">
                  Permohonan izin untuk "<span className="font-medium text-gray-700">{selectedPermit.purpose}</span>" akan dihapus secara permanen dan tidak dapat dikembalikan.
                </p>
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
