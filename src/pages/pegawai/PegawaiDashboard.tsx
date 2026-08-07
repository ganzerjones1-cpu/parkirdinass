import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { VehiclePairWithDetails, ParkingLog } from '../../types/database';
import { Car, Calendar, FileText, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export function PegawaiDashboard() {
  const { userWithEmployee } = useAuth();
  const [pairData, setPairData] = useState<VehiclePairWithDetails[]>([]);
  const [recentLogs, setRecentLogs] = useState<ParkingLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPegawaiData();
  }, [userWithEmployee]);

  const fetchPegawaiData = async () => {
    if (!userWithEmployee?.employee?.id) {
      setLoading(false);
      return;
    }

    try {
      // Get all vehicle pairs for this employee
      const { data: pairs, error: pairError } = await supabase
        .from('vehicle_driver_pairs')
        .select(`
          *,
          vehicle:vehicles (*),
          employee:employees (*)
        `)
        .eq('employee_id', userWithEmployee.employee.id)
        .is('deleted_at', null);

      if (pairError) throw pairError;

      const pairList = (pairs || []) as unknown as VehiclePairWithDetails[];
      setPairData(pairList);

      if (pairList.length > 0) {
        const pairIds = pairList.map(p => p.id);
        const { data: logs, error: logsError } = await supabase
          .from('parking_logs')
          .select('*')
          .in('pair_id', pairIds)
          .order('created_at', { ascending: false })
          .limit(10);

        if (logsError) throw logsError;
        setRecentLogs(logs || []);
      }
    } catch (error) {
      console.error('Error fetching pegawai data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold mb-2">
          Selamat Datang, {userWithEmployee?.employee?.nama_lengkap}!
        </h1>
        <p className="text-blue-100">
          NIP: {userWithEmployee?.employee?.nip} | {userWithEmployee?.employee?.jabatan_pangkat}
        </p>
      </div>

      {/* Vehicle Info Cards */}
      {pairData.length > 0 ? (
        <div className="space-y-4">
          <div className="bg-gray-50 px-6 py-4 border-b rounded-t-xl">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Car className="w-5 h-5" />
              Kendaraan Dinas Anda ({pairData.length})
            </h2>
          </div>
          {pairData.map((pair) => (
            <div key={pair.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600">Nomor Polisi</p>
                    <p className="text-xl font-bold text-gray-900">{pair.vehicle.no_polisi}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Instansi</p>
                    <p className="text-xl font-bold text-gray-900">{pair.vehicle.nama_instansi}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tipe / Merk</p>
                    <p className="text-lg font-semibold text-gray-900">{pair.vehicle.tipe_merk}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Jenis</p>
                    <p className="text-lg font-semibold text-gray-900">{pair.vehicle.jenis_kendaraan}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status QR</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      pair.vehicle.status_qr === 'Aktif'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {pair.vehicle.status_qr === 'Aktif' ? (
                        <CheckCircle className="w-4 h-4 mr-1" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-1" />
                      )}
                      {pair.vehicle.status_qr}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Kondisi Aset Terakhir</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      pair.vehicle.kondisi_aset_terakhir === 'Baik'
                        ? 'bg-green-100 text-green-700'
                        : pair.vehicle.kondisi_aset_terakhir === 'Rusak Ringan'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {pair.vehicle.kondisi_aset_terakhir}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800">Belum Ada Kendaraan Dinas</h3>
              <p className="text-yellow-700 text-sm mt-1">
                Anda belum dikaitkan dengan kendaraan dinas apapun. Silakan hubungi Admin Parkir.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Parking Logs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Riwayat Parkir Terakhir
          </h2>
        </div>
        <div className="divide-y">
          {recentLogs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Belum ada riwayat parkir
            </div>
          ) : (
            recentLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        log.status === 'Di_Lahan'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {log.status === 'Di_Lahan' ? 'Di Lahan' : 'Di Luar'}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        log.check_out_condition === 'Baik'
                          ? 'bg-green-100 text-green-700'
                          : log.check_out_condition === 'Rusak Ringan'
                          ? 'bg-yellow-100 text-yellow-700'
                          : log.check_out_condition
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {log.check_out_condition || 'Belum Check-out'}
                      </span>
                    </div>
                    {log.purpose && (
                      <p className="text-sm text-gray-600 mt-1">{log.purpose}</p>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {log.check_out_time ? (
                      <>
                        <p>{format(new Date(log.check_out_time), 'dd MMM yyyy', { locale: id })}</p>
                        <p className="text-xs">{format(new Date(log.check_out_time), 'HH:mm', { locale: id })}</p>
                      </>
                    ) : log.check_in_time ? (
                      <>
                        <p>{format(new Date(log.check_in_time), 'dd MMM yyyy', { locale: id })}</p>
                        <p className="text-xs">{format(new Date(log.check_in_time), 'HH:mm', { locale: id })}</p>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
