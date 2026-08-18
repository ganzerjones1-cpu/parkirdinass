import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Edit2, Trash2, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import type { AssetCondition } from '../../types/database';

interface CRUDModalProps {
  isOpen: boolean;
  mode: 'edit' | 'delete' | null;
  data: any;
  reportType: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReportsCRUDModal({ isOpen, mode, data, reportType, onClose, onSuccess }: CRUDModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data) {
      setFormData({ ...data });
    }
  }, [data]);

  const handleUpdate = async () => {
    if (!data?.id || !reportType) return;

    setLoading(true);
    try {
      const updateData: any = {};

      switch (reportType) {
        case 'parking_logs':
          updateData.check_in_condition = formData.check_in_condition;
          updateData.check_out_condition = formData.check_out_condition;
          updateData.purpose = formData.purpose;
          updateData.status = formData.status;
          break;
        case 'violations':
          updateData.violation_type = formData.violation_type;
          updateData.violation_date = formData.violation_date;
          break;
        case 'permits':
          updateData.purpose = formData.purpose;
          updateData.start_date = formData.start_date;
          updateData.end_date = formData.end_date;
          updateData.status = formData.status;
          break;
      }

      const { error } = await supabase
        .from(reportType)
        .update(updateData)
        .eq('id', data.id);

      if (error) throw error;
      toast.success('Data berhasil diperbarui');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating data:', error);
      toast.error('Gagal memperbarui data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!data?.id || !reportType) return;

    if (!window.confirm('Apakah Anda yakin ingin menghapus data ini?')) return;

    setLoading(true);
    try {
      // For soft delete, update deleted_at instead
      if (['parking_logs', 'violations', 'permits'].includes(reportType)) {
        const { error } = await supabase
          .from(reportType)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', data.id);

        if (error) throw error;
      }

      toast.success('Data berhasil dihapus');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error deleting data:', error);
      toast.error('Gagal menghapus data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'edit' ? 'Edit Data' : 'Hapus Data'}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {mode === 'edit' && (
            <div className="space-y-4">
              {reportType === 'parking_logs' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status || ''}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Di_Lahan">Di Lahan</option>
                      <option value="Di_Luar_Lahan">Di Luar Lahan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kondisi Masuk
                    </label>
                    <select
                      value={formData.check_in_condition || ''}
                      onChange={(e) => setFormData({ ...formData, check_in_condition: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Baik">Baik</option>
                      <option value="Rusak Ringan">Rusak Ringan</option>
                      <option value="Rusak Berat">Rusak Berat</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kondisi Keluar
                    </label>
                    <select
                      value={formData.check_out_condition || ''}
                      onChange={(e) => setFormData({ ...formData, check_out_condition: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Belum diisi</option>
                      <option value="Baik">Baik</option>
                      <option value="Rusak Ringan">Rusak Ringan</option>
                      <option value="Rusak Berat">Rusak Berat</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Keperluan
                    </label>
                    <input
                      type="text"
                      value={formData.purpose || ''}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Keperluan"
                    />
                  </div>
                </>
              )}

              {reportType === 'violations' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jenis Pelanggaran
                    </label>
                    <select
                      value={formData.violation_type || ''}
                      onChange={(e) => setFormData({ ...formData, violation_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="parkir_hari_libur">Parkir Hari Libur</option>
                      <option value="parkir_terlarang">Parkir Terlarang</option>
                      <option value="kondisi_buruk">Kondisi Buruk</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal Pelanggaran
                    </label>
                    <input
                      type="date"
                      value={formData.violation_date?.split('T')[0] || ''}
                      onChange={(e) => setFormData({ ...formData, violation_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {reportType === 'permits' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status || ''}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Disetujui">Disetujui</option>
                      <option value="Ditolak">Ditolak</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Keperluan
                    </label>
                    <input
                      type="text"
                      value={formData.purpose || ''}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal Mulai
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.start_date?.replace('Z', '') || ''}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal Selesai
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.end_date?.replace('Z', '') || ''}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {mode === 'delete' && (
            <p className="text-gray-700">
              Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.
            </p>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={mode === 'edit' ? handleUpdate : handleDelete}
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2 ${
              mode === 'edit'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-red-600 hover:bg-red-700'
            } disabled:opacity-50`}
          >
            {loading ? 'Memproses...' : mode === 'edit' ? 'Simpan' : 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  );
}
