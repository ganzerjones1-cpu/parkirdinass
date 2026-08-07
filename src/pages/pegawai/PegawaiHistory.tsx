import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Calendar, FileText, Car, Clock, CheckCircle, XCircle, Filter, Eye, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import type { Permit, ParkingLog, Vehicle } from '../../types/database';

interface PermitWithVehicle extends Permit {
  vehicle: Vehicle | null;
}

interface ParkingLogWithDetails extends ParkingLog {
  vehicle: Vehicle | null;
}

type TabType = 'permits' | 'parking';
type PermitFilter = 'all' | 'Menunggu' | 'Disetujui' | 'Ditolak';
type ParkingFilter = 'all' | 'Di_Lahan' | 'Di_Luar_Lahan';

export function PegawaiHistory() {
  const { userWithEmployee } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('permits');
  const [permits, setPermits] = useState<PermitWithVehicle[]>([]);
  const [parkingLogs, setParkingLogs] = useState<ParkingLogWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [permitFilter, setPermitFilter] = useState<PermitFilter>('all');
  const [parkingFilter, setParkingFilter] = useState<ParkingFilter>('all');
  const [selectedPermit, setSelectedPermit] = useState<PermitWithVehicle | null>(null);
  const [selectedLog, setSelectedLog] = useState<ParkingLogWithDetails | null>(null);

  useEffect(() => {
    fetchData();
  }, [userWithEmployee]);

  const fetchData = async () => {
    if (!userWithEmployee?.employee?.id) return;

    setLoading(true);
    try {
      // Fetch all permits
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

      // Fetch pair ID first
      const { data: pairData } = await supabase
        .from('vehicle_driver_pairs')
        .select('id, vehicle:vehicles (*)')
        .eq('employee_id', userWithEmployee.employee.id)
        .is('deleted_at', null);

      if (pairData && pairData.length > 0) {
        const pairIds = pairData.map(p => p.id);
        const vehicleMap: Record<string, Vehicle> = {};
        pairData.forEach(p => {
          if (p.vehicle) {
            vehicleMap[p.id] = p.vehicle as unknown as Vehicle;
          }
        });

        // Fetch all parking logs
        const { data: logsData, error: logsError } = await supabase
          .from('parking_logs')
          .select('*')
          .in('pair_id', pairIds)
          .order('created_at', { ascending: false });

        if (logsError) throw logsError;

        const logsWithVehicle = (logsData || []).map(log => ({
          ...log,
          vehicle: vehicleMap[log.pair_id] || null
        }));

        setParkingLogs(logsWithVehicle as unknown as ParkingLogWithDetails[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
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
      case 'Disetujui': return 'bg-green-100 text-green-700 border-green-200';
      case 'Ditolak': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const filteredPermits = permits.filter(p => {
    if (permitFilter === 'all') return true;
    return p.status === permitFilter;
  });

  const filteredLogs = parkingLogs.filter(log => {
    if (parkingFilter === 'all') return true;
    return log.status === parkingFilter;
  });

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Riwayat</h1>
        <p className="text-gray-600 mt-1">Lihat riwayat izin dan penggunaan kendaraan</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('permits')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'permits'
                ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-5 h-5" />
            Riwayat Izin
            <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
              {permits.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('parking')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'parking'
                ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Car className="w-5 h-5" />
            Riwayat Parkir
            <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
              {parkingLogs.length}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Memuat data...</div>
          ) : activeTab === 'permits' ? (
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={permitFilter}
                  onChange={(e) => setPermitFilter(e.target.value as PermitFilter)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Semua Status</option>
                  <option value="Menunggu">Menunggu</option>
                  <option value="Disetujui">Disetujui</option>
                  <option value="Ditolak">Ditolak</option>
                </select>
              </div>

              {/* List */}
              {filteredPermits.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">Tidak ada riwayat izin</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPermits.map((permit) => (
                    <div
                      key={permit.id}
                      className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-shrink-0">{getStatusIcon(permit.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">{permit.purpose}</p>
                            <p className="text-sm text-gray-600">
                              {permit.vehicle?.no_polisi} - {permit.vehicle?.nama_instansi}
                            </p>
                          </div>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(permit.status)}`}>
                            {permit.status}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(permit.start_date), 'dd MMM yyyy', { locale: id })} - {format(new Date(permit.end_date), 'dd MMM yyyy', { locale: id })}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedPermit(permit)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={parkingFilter}
                  onChange={(e) => setParkingFilter(e.target.value as ParkingFilter)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Semua Status</option>
                  <option value="Di_Lahan">Di Lahan</option>
                  <option value="Di_Luar_Lahan">Di Luar Lahan</option>
                </select>
              </div>

              {/* List */}
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Car className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">Tidak ada riwayat parkir</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {log.status === 'Di_Lahan' ? (
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <Car className="w-5 h-5 text-green-600" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Car className="w-5 h-5 text-blue-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">
                              {log.vehicle?.no_polisi || 'Kendaraan tidak ditemukan'}
                            </p>
                            <p className="text-sm text-gray-600">{log.vehicle?.nama_instansi}</p>
                          </div>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                            log.status === 'Di_Lahan'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {log.status === 'Di_Lahan' ? 'Di Lahan' : 'Di Luar Lahan'}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          {log.check_in_time && (
                            <div>
                              <span className="font-medium text-gray-700">Masuk:</span>{' '}
                              {format(new Date(log.check_in_time), 'dd MMM yyyy, HH:mm', { locale: id })}
                            </div>
                          )}
                          {log.check_out_time && (
                            <div>
                              <span className="font-medium text-gray-700">Keluar:</span>{' '}
                              {format(new Date(log.check_out_time), 'dd MMM yyyy, HH:mm', { locale: id })}
                            </div>
                          )}
                        </div>
                        {log.purpose && (
                          <p className="mt-1 text-sm text-gray-600">Keperluan: {log.purpose}</p>
                        )}
                        <div className="mt-2 flex gap-2">
                          {log.check_in_condition && (
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              log.check_in_condition === 'Baik'
                                ? 'bg-green-50 text-green-700'
                                : log.check_in_condition === 'Rusak Ringan'
                                ? 'bg-yellow-50 text-yellow-700'
                                : 'bg-red-50 text-red-700'
                            }`}>
                              Masuk: {log.check_in_condition}
                            </span>
                          )}
                          {log.check_out_condition && (
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              log.check_out_condition === 'Baik'
                                ? 'bg-green-50 text-green-700'
                                : log.check_out_condition === 'Rusak Ringan'
                                ? 'bg-yellow-50 text-yellow-700'
                                : 'bg-red-50 text-red-700'
                            }`}>
                              Keluar: {log.check_out_condition}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail Permit Modal */}
      {selectedPermit && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setSelectedPermit(null)} />
            <div className="inline-block w-full max-w-lg p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Detail Izin</h3>
                <button onClick={() => setSelectedPermit(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  {getStatusIcon(selectedPermit.status)}
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(selectedPermit.status)}`}>
                      {selectedPermit.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Car className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Kendaraan</p>
                    <p className="font-medium">{selectedPermit.vehicle?.no_polisi}</p>
                    <p className="text-sm text-gray-600">{selectedPermit.vehicle?.nama_instansi}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Periode</p>
                    <p className="font-medium">
                      {format(new Date(selectedPermit.start_date), 'dd MMM yyyy, HH:mm', { locale: id })} -{' '}
                      {format(new Date(selectedPermit.end_date), 'dd MMM yyyy, HH:mm', { locale: id })}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Keperluan</p>
                  <p className="font-medium">{selectedPermit.purpose}</p>
                </div>

                {selectedPermit.spt_document_url && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Dokumen SPT</p>
                    <a
                      href={selectedPermit.spt_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Lihat Dokumen
                    </a>
                  </div>
                )}

                {selectedPermit.rejection_reason && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-700 mb-1">Alasan Penolakan</p>
                    <p className="text-red-600">{selectedPermit.rejection_reason}</p>
                  </div>
                )}

                <div className="text-xs text-gray-400 space-y-1 pt-2 border-t">
                  <p>Dibuat: {format(new Date(selectedPermit.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <button
                  onClick={() => setSelectedPermit(null)}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Parking Log Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setSelectedLog(null)} />
            <div className="inline-block w-full max-w-lg p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Detail Riwayat Parkir</h3>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selectedLog.status === 'Di_Lahan' ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    <Car className={`w-5 h-5 ${selectedLog.status === 'Di_Lahan' ? 'text-green-600' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      selectedLog.status === 'Di_Lahan'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {selectedLog.status === 'Di_Lahan' ? 'Di Lahan' : 'Di Luar Lahan'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Car className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Kendaraan</p>
                    <p className="font-medium">{selectedLog.vehicle?.no_polisi || '-'}</p>
                    <p className="text-sm text-gray-600">{selectedLog.vehicle?.nama_instansi || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Waktu Check-In</p>
                    <p className="font-medium">
                      {selectedLog.check_in_time
                        ? format(new Date(selectedLog.check_in_time), 'dd MMM yyyy, HH:mm', { locale: id })
                        : '-'}
                    </p>
                    <div className="mt-2">
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        selectedLog.check_in_condition === 'Baik'
                          ? 'bg-green-50 text-green-700'
                          : selectedLog.check_in_condition === 'Rusak Ringan'
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {selectedLog.check_in_condition || '-'}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Waktu Check-Out</p>
                    <p className="font-medium">
                      {selectedLog.check_out_time
                        ? format(new Date(selectedLog.check_out_time), 'dd MMM yyyy, HH:mm', { locale: id })
                        : '-'}
                    </p>
                    <div className="mt-2">
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        selectedLog.check_out_condition === 'Baik'
                          ? 'bg-green-50 text-green-700'
                          : selectedLog.check_out_condition === 'Rusak Ringan'
                          ? 'bg-yellow-50 text-yellow-700'
                          : selectedLog.check_out_condition
                          ? 'bg-red-50 text-red-700'
                          : 'bg-gray-50 text-gray-500'
                      }`}>
                        {selectedLog.check_out_condition || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedLog.purpose && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Keperluan</p>
                    <p className="font-medium">{selectedLog.purpose}</p>
                  </div>
                )}

                <div className="text-xs text-gray-400 space-y-1 pt-2 border-t">
                  <p>Tercatat: {format(new Date(selectedLog.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
