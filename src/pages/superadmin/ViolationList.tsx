import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { ViolationWithDetails } from '../../types/database';
import { AlertTriangle, Unlock, User, Car, Calendar, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export function ViolationList() {
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);

  useEffect(() => {
    fetchViolations();
  }, []);

  const fetchViolations = async () => {
    try {
      const { data, error } = await supabase
        .from('violations')
        .select(`
          *,
          pair:vehicle_driver_pairs (
            id,
            vehicle:vehicles (*),
            employee:employees (*)
          ),
          parking_log:parking_logs (*)
        `)
        .order('violation_date', { ascending: false });

      if (error) throw error;
      setViolations(data || []);
    } catch (error) {
      console.error('Error fetching violations:', error);
      toast.error('Gagal memuat data pelanggaran');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!selectedPairId) return;

    try {
      // Get vehicle ID from pair
      const pair = violations.find((v) => v.pair?.id === selectedPairId);

      if (!pair?.pair?.vehicle?.id) {
        toast.error('Data kendaraan tidak ditemukan');
        return;
      }

      // Update vehicle status to Aktif
      const { error } = await supabase
        .from('vehicles')
        .update({
          status_qr: 'Aktif',
          updated_at: new Date().toISOString(),
        })
        .eq('id', pair.pair.vehicle.id);

      if (error) throw error;
      toast.success('QR Code berhasil dibuka blokirnya');
      setShowUnblockModal(false);
      setSelectedPairId(null);
      fetchViolations();
    } catch (error) {
      console.error('Error unblocking vehicle:', error);
      toast.error('Gagal membuka blokir');
    }
  };

  const blockedVehicles = violations.filter(
    (v) => v.pair?.vehicle?.status_qr === 'Terblokir'
  );
  const recentViolations = violations.slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Early Warning System</h1>
        <p className="text-gray-600 mt-1">Daftar Merah Pelanggaran Parkir Hari Libur</p>
      </div>

      {/* Blocked Vehicles Alert */}
      {blockedVehicles.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-bold text-red-900">
                PERINGATAN: {blockedVehicles.length} Kendaraan Terblokir
              </h2>
              <p className="text-sm text-red-700 mt-1">
                Kendaraan-kendaraan berikut telah melanggar 3x berturut-turut dan QR Code-nya telah dikunci otomatis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {blockedVehicles.map((v) => (
              <div key={v.id} className="bg-white rounded-lg p-4 border border-red-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Car className="w-4 h-4 text-red-600" />
                      <span className="font-semibold text-gray-900">
                        {v.pair?.vehicle?.no_polisi}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {v.pair?.employee?.nama_lengkap}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Pelanggaran ke-{v.consecutive_count} pada minggu ke-{v.week_number}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPairId(v.pair?.id);
                      setShowUnblockModal(true);
                    }}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    <Unlock className="w-4 h-4" />
                    Buka Blokir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Violations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Riwayat Pelanggaran
            </h2>
            <button
              onClick={fetchViolations}
              disabled={loading}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kendaraan</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                  Sopir
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                  Pelanggaran Ke-
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              ) : recentViolations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Tidak ada pelanggaran tercatat
                  </td>
                </tr>
              ) : (
                recentViolations.map((violation) => (
                  <tr key={violation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Car className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {violation.pair?.vehicle?.no_polisi}
                          </p>
                          <p className="text-xs text-gray-600">
                            {violation.pair?.vehicle?.nama_instansi}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <p className="text-sm text-gray-900">{violation.pair?.employee?.nama_lengkap}</p>
                      <p className="text-xs text-gray-600">{violation.pair?.employee?.nip}</p>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell text-sm text-gray-600">
                      {format(new Date(violation.violation_date), 'dd MMM yyyy HH:mm', { locale: id })}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                            violation.consecutive_count >= 3
                              ? 'bg-red-100 text-red-700'
                              : violation.consecutive_count >= 2
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {violation.consecutive_count}
                        </span>
                        {violation.is_consecutive && (
                          <span className="text-xs text-yellow-600 font-medium">Berturut</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          violation.pair?.vehicle?.status_qr === 'Terblokir'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {violation.pair?.vehicle?.status_qr === 'Terblokir' ? 'Di Blokir' : 'Aktif'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unblock Modal */}
      {showUnblockModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowUnblockModal(false)}
            />
            <div className="inline-block w-full max-w-md p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <Unlock className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Buka Blokir Kendaraan?</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Tindakan ini akan membuka kembali fungsi scan QR Code untuk kendaraan ini.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowUnblockModal(false);
                      setSelectedPairId(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleUnblock}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    Buka Blokir
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
