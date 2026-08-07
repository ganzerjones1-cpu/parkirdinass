import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { Camera, X, AlertCircle, CheckCircle, Keyboard, Search, Car, User, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PairWithDetails {
  id: string;
  vehicle_id: string;
  employee_id: string;
  qr_code: string;
  vehicle: { no_polisi: string; tipe_merk: string; nama_instansi: string; status_qr: string };
  employee: { nip: string; nama_lengkap: string; jabatan_pangkat: string };
}

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
}

export function QRScanner({ onScanSuccess, onScanError }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [pairs, setPairs] = useState<PairWithDetails[]>([]);
  const [pairsLoading, setPairsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-reader';

  const fetchPairs = async () => {
    setPairsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('vehicle_driver_pairs')
        .select(
          `
          id,
          vehicle_id,
          employee_id,
          qr_code,
          vehicle:vehicles (no_polisi, tipe_merk, nama_instansi, status_qr),
          employee:employees (nip, nama_lengkap, jabatan_pangkat)
          `
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPairs((data || []) as unknown as PairWithDetails[]);
    } catch (err) {
      console.error('Error fetching pairs:', err);
      toast.error('Gagal memuat daftar kendaraan & sopir');
    } finally {
      setPairsLoading(false);
    }
  };

  const startScanning = async () => {
    setError(null);
    setIsScanning(true);

    try {
      const html5QrCode = new Html5Qrcode(containerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          onScanSuccess(decodedText);
          stopScanning();
        },
        (errorMessage) => {
          // Ignore frequent scan errors
          if (!errorMessage.includes('No QR code found')) {
            console.warn('Scan error:', errorMessage);
          }
        }
      );
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan, atau gunakan mode input manual.');
      setIsScanning(false);
      onScanError?.('Camera access denied');
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pair = pairs.find((p) => p.id === selectedPairId);
    if (!pair) {
      toast.error('Pilih kendaraan & sopir terlebih dahulu');
      return;
    }

    // Build a QR-compatible payload so the existing scan handler treats it exactly
    // like a camera scan — same lookup, same check-in/check-out persistence.
    const syntheticQR = JSON.stringify({
      vehicle_id: pair.vehicle_id,
      employee_id: pair.employee_id,
      pair_id: pair.id,
      no_polisi: pair.vehicle.no_polisi,
      nama: pair.employee.nama_lengkap,
      nip: pair.employee.nip,
      timestamp: Date.now(),
    });

    onScanSuccess(syntheticQR);
    setSelectedPairId(null);
    setSearchTerm('');
  };

  const filteredPairs = pairs.filter(
    (p) =>
      p.vehicle.no_polisi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.employee.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.employee.nip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.qr_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPair = pairs.find((p) => p.id === selectedPairId);

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="w-full">
      {/* Mode switcher */}
      <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => { setMode('camera'); setError(null); }}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            mode === 'camera' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Camera className="w-4 h-4" />
          Kamera
        </button>
        <button
          onClick={() => { setMode('manual'); stopScanning(); setError(null); }}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            mode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          Input Manual
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {mode === 'camera' ? (
        <>
          <div id={containerId} className="w-full mb-4"></div>

          {!isScanning ? (
            <button
              onClick={startScanning}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Mulai Scan QR Code
            </button>
          ) : (
            <button
              onClick={stopScanning}
              className="w-full bg-gray-600 text-white py-4 rounded-lg font-medium hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              Berhenti Scan
            </button>
          )}
        </>
      ) : (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cari Kendaraan / Sopir
            </label>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={fetchPairs}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Cari nomor polisi, nama sopir, NIP, atau kode QR..."
                disabled={pairsLoading}
              />
            </div>

            {pairsLoading ? (
              <div className="flex items-center justify-center py-6 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Memuat daftar paket...
              </div>
            ) : filteredPairs.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                {pairs.length === 0
                  ? 'Ketik di kotak pencarian untuk memuat daftar.'
                  : 'Tidak ada paket yang cocok.'}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {filteredPairs.map((pair) => {
                  const isBlocked = pair.vehicle.status_qr === 'Terblokir';
                  return (
                    <button
                      type="button"
                      key={pair.id}
                      onClick={() => {
                        setSelectedPairId(pair.id);
                        setSearchTerm('');
                      }}
                      className={`w-full text-left p-3 transition-colors ${
                        selectedPairId === pair.id
                          ? 'bg-blue-50 border-l-4 border-l-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Car className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {pair.vehicle.no_polisi}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {pair.vehicle.tipe_merk} · {pair.vehicle.nama_instansi}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <User className="w-3 h-3 text-green-600" />
                            <p className="text-xs text-gray-700 truncate">
                              {pair.employee.nama_lengkap} · NIP {pair.employee.nip}
                            </p>
                          </div>
                        </div>
                        {isBlocked && (
                          <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">
                            Terblokir
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedPair && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                Terpilih: <strong>{selectedPair.vehicle.no_polisi}</strong> — {selectedPair.employee.nama_lengkap}
              </p>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Mode ini menyimpan data parkir sama persis seperti pemindaian QR Code.
          </p>

          <button
            type="submit"
            disabled={!selectedPairId}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-5 h-5" />
            Proses Paket Terpilih
          </button>
        </form>
      )}
    </div>
  );
}

// Alternative component using Html5QrcodeScanner (simpler setup)
export function QRScannerSimple({ onScanSuccess }: QRScannerProps) {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      'qr-reader-simple',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scannerRef.current.render(
      (decodedText) => {
        setScanResult(decodedText);
        onScanSuccess(decodedText);
      },
      (error) => {
        console.warn('Scan error:', error);
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScanSuccess]);

  return (
    <div>
      <div id="qr-reader-simple" className="w-full"></div>
      {scanResult && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">QR Code Terdeteksi</p>
              <p className="text-xs text-green-700 mt-1 break-all">{scanResult}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
