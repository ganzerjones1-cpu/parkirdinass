import React, { useState, useEffect } from 'react';
import { QRScanner } from '../../components/QRScanner';
import { parseQRCode } from '../../lib/qrcode';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Vehicle, Employee, VehicleDriverPair, Permit, ParkingLog, AssetCondition } from '../../types/database';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Car,
  User,
  FileText,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface ScanResult {
  vehicle: Vehicle;
  employee: Employee;
  pair: VehicleDriverPair;
  currentLog?: ParkingLog;
  activePermit?: Permit;
}

export function AdminScan() {
  const { user } = useAuth();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'check_in' | 'check_out' | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<AssetCondition>('Baik');
  const [purpose, setPurpose] = useState('');

  const handleScanSuccess = async (decodedText: string) => {
    setLoading(true);
    try {
      const qrData = parseQRCode(decodedText);

      if (!qrData) {
        toast.error('Format QR Code tidak valid');
        setLoading(false);
        return;
      }

      // Fetch pair data with vehicle and employee
      const { data: pair, error: pairError } = await supabase
        .from('vehicle_driver_pairs')
        .select(`
          *,
          vehicle:vehicles (*),
          employee:employees (*)
        `)
        .eq('id', qrData.pair_id)
        .is('deleted_at', null)
        .single();

      if (pairError || !pair) {
        toast.error('Data paket kendaraan tidak ditemukan');
        setLoading(false);
        return;
      }

      // Check if vehicle is blocked
      if (pair.vehicle.status_qr === 'Terblokir') {
        toast.error('AKSES DIKUNCI: Pelanggaran Parkir Hari Libur 3x Berturut-turut. Harap Lapor Kasat Satpol PP.');
        setLoading(false);
        return;
      }

      // Check for active permit (for weekends/holidays)
      const now = new Date();
      const { data: permits } = await supabase
        .from('permits')
        .select('*')
        .eq('vehicle_id', pair.vehicle_id)
        .eq('status', 'Disetujui')
        .lte('start_date', now.toISOString())
        .gte('end_date', now.toISOString())
        .limit(1);

      const activePermit = permits && permits.length > 0 ? permits[0] : undefined;

      // Check current parking status - look for an active log that's been checked in but not checked out
      const { data: logs } = await supabase
        .from('parking_logs')
        .select('*')
        .eq('pair_id', pair.id)
        .eq('status', 'Di_Lahan')
        .is('check_out_time', null)
        .order('created_at', { ascending: false })
        .limit(1);

      const currentLog = logs && logs.length > 0 ? logs[0] : undefined;

      setScanResult({
        vehicle: pair.vehicle as unknown as Vehicle,
        employee: pair.employee as unknown as Employee,
        pair: pair as unknown as VehicleDriverPair,
        currentLog,
        activePermit,
      });

      toast.success('QR Code berhasil dipindai');
    } catch (error) {
      console.error('Error processing scan:', error);
      toast.error('Terjadi kesalahan saat memproses QR Code');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!scanResult || !user) return;

    setLoading(true);
    try {
      // Create new parking log
      const { data: logData, error: insertError } = await supabase
        .from('parking_logs')
        .insert({
          pair_id: scanResult.pair.id,
          check_in_time: new Date().toISOString(),
          check_in_condition: selectedCondition,
          checked_in_by: user.id,
          status: 'Di_Lahan',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update vehicle condition
      await supabase
        .from('vehicles')
        .update({ kondisi_aset_terakhir: selectedCondition, updated_at: new Date().toISOString() })
        .eq('id', scanResult.vehicle.id);

      toast.success('Check-in berhasil');
      setScanResult(null);
      setAction(null);
      setSelectedCondition('Baik');
      setPurpose('');
    } catch (error) {
      console.error('Error checking in:', error);
      toast.error('Gagal melakukan check-in');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!scanResult || !user || !scanResult.currentLog) return;

    try {
      // Update parking log
      const { error: updateError } = await supabase
        .from('parking_logs')
        .update({
          check_out_time: new Date().toISOString(),
          check_out_condition: selectedCondition,
          checked_out_by: user.id,
          status: 'Di_Luar_Lahan',
          purpose,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scanResult.currentLog.id);

      if (updateError) throw updateError;

      // Update vehicle condition
      await supabase
        .from('vehicles')
        .update({ kondisi_aset_terakhir: selectedCondition, updated_at: new Date().toISOString() })
        .eq('id', scanResult.vehicle.id);

      toast.success('Check-out berhasil');
      setScanResult(null);
      setAction(null);
      setSelectedCondition('Baik');
      setPurpose('');
    } catch (error) {
      console.error('Error checking out:', error);
      toast.error('Gagal melakukan check-out');
    }
  };

  const isWeekend = () => {
    const today = new Date();
    const day = today.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h1 className="text-xl font-bold text-white">Scan QR Code</h1>
          <p className="text-blue-100 text-sm mt-1">
            Pindai QR Code pada kendaraan di gerbang
          </p>
        </div>

        <div className="p-6">
          {!scanResult ? (
            <>
              <QRScanner onScanSuccess={handleScanSuccess} />

              {isWeekend() && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800">Mode Hari Libur Aktif</p>
                      <p className="text-yellow-700 mt-1">
                        Pastikan kendaraan memiliki E-Izin yang disetujui untuk digunakan di hari libur.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {loading && (
                <div className="mt-4 text-center text-gray-600">
                  Memproses QR Code...
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              {/* Vehicle Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Car className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{scanResult.vehicle.no_polisi}</h3>
                    <p className="text-sm text-gray-600">{scanResult.vehicle.tipe_merk}</p>
                    <p className="text-xs text-gray-500">{scanResult.vehicle.nama_instansi}</p>
                  </div>
                </div>
              </div>

              {/* Driver Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{scanResult.employee.nama_lengkap}</h3>
                    <p className="text-sm text-gray-600">NIP: {scanResult.employee.nip}</p>
                    <p className="text-xs text-gray-500">{scanResult.employee.jabatan_pangkat}</p>
                  </div>
                </div>
              </div>

              {/* Permit Status */}
              {isWeekend() && (
                <div className={`rounded-lg p-4 ${
                  scanResult.activePermit
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {scanResult.activePermit ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-green-800">E-Izin Aktif</p>
                          <p className="text-sm text-green-700 mt-1">
                            Berlaku: {format(new Date(scanResult.activePermit.start_date), 'dd/MM/yyyy HH:mm')} - {format(new Date(scanResult.activePermit.end_date), 'dd/MM/yyyy HH:mm')}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-red-800">Tidak Ada E-Izin</p>
                          <p className="text-sm text-red-700 mt-1">
                            Tidak dapat mengeluarkan kendaraan di hari libur tanpa E-Izin yang disetujui!
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Current Status */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-800">
                      Status: {scanResult.currentLog ? 'Di Luar Lahan' : 'Di Lahan'}
                    </p>
                    <p className="text-sm text-blue-700">
                      Kondisi Terakhir: {scanResult.vehicle.kondisi_aset_terakhir}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {!action ? (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setAction('check_in')}
                    disabled={scanResult.currentLog !== undefined || loading}
                    className={`text-white py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      scanResult.currentLog !== undefined || loading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 active:scale-95'
                    }`}
                  >
                    <Check className="w-5 h-5" />
                    Check-In
                  </button>
                  <button
                    onClick={() => setAction('check_out')}
                    disabled={!scanResult.currentLog || loading}
                    className={`text-white py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      !scanResult.currentLog || loading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                    }`}
                  >
                    <X className="w-5 h-5" />
                    Check-Out
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Condition Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kondisi Kendaraan Saat Ini
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Baik', 'Rusak Ringan', 'Rusak Berat'] as AssetCondition[]).map((cond) => (
                        <button
                          key={cond}
                          onClick={() => setSelectedCondition(cond)}
                          className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                            selectedCondition === cond
                              ? cond === 'Baik'
                                ? 'bg-green-600 text-white'
                                : cond === 'Rusak Ringan'
                                ? 'bg-yellow-600 text-white'
                                : 'bg-red-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {cond}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Purpose (for check-out only) */}
                  {action === 'check_out' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Keperluan
                      </label>
                      <input
                        type="text"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Contoh: Dinas ke kantor dinas"
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => {
                        setAction(null);
                        setSelectedCondition('Baik');
                        setPurpose('');
                      }}
                      disabled={loading}
                      className="bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Batal
                    </button>
                    <button
                      onClick={action === 'check_in' ? handleCheckIn : handleCheckOut}
                      disabled={loading}
                      className={`text-white py-3 rounded-lg font-medium transition-all ${
                        action === 'check_in'
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loading ? 'Memproses...' : `Konfirmasi ${action === 'check_in' ? 'Check-In' : 'Check-Out'}`}
                    </button>
                  </div>
                </div>
              )}

              {/* Back button */}
              <button
                onClick={() => {
                  setScanResult(null);
                  setAction(null);
                }}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-all"
              >
                Scan Ulang
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
