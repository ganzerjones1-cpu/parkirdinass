import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { generateQRCode } from '../../lib/qrcode';
import type { Vehicle, Employee, VehicleDriverPair } from '../../types/database';
import {
  Plus,
  Search,
  Trash2,
  X,
  QrCode,
  Link as LinkIcon,
  Download,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function PairManagement() {
  const [pairs, setPairs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedPair, setSelectedPair] = useState<any | null>(null);
  const [qrCodeImage, setQRCodeImage] = useState<string>('');
  const [formData, setFormData] = useState({
    vehicle_id: '',
    employee_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pairsRes, vehiclesRes, employeesRes] = await Promise.all([
        supabase
          .from('vehicle_driver_pairs')
          .select(
            `
          *,
          vehicle:vehicles (*),
          employee:employees (*)
        `
          )
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('vehicles')
          .select('*')
          .is('deleted_at', null)
          .eq('status_qr', 'Aktif'),
        supabase.from('employees').select('*').is('deleted_at', null),
      ]);

      if (pairsRes.error) throw pairsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (employeesRes.error) throw employeesRes.error;

      setPairs(pairsRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const vehicle = vehicles.find((v) => v.id === formData.vehicle_id);
      const employee = employees.find((e) => e.id === formData.employee_id);

      if (!vehicle || !employee) {
        toast.error('Data tidak valid');
        return;
      }

      const qrCodeString = `QR-${vehicle.no_polisi.replace(/\s+/g, '')}-${employee.nip}`;

      const { error } = await supabase.from('vehicle_driver_pairs').insert({
        vehicle_id: formData.vehicle_id,
        employee_id: formData.employee_id,
        qr_code: qrCodeString,
        is_primary_driver: true,
      });

      if (error) throw error;
      toast.success('Paket kendaraan berhasil dibuat');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error creating pair:', error);
      toast.error(error.message || 'Gagal membuat paket');
    }
  };

  const handleDelete = async (pairId: string) => {
    try {
      const { error } = await supabase
        .from('vehicle_driver_pairs')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', pairId);

      if (error) throw error;
      toast.success('Paket berhasil dihapus');
      fetchData();
    } catch (error) {
      console.error('Error deleting pair:', error);
      toast.error('Gagal menghapus paket');
    }
  };

  const handleShowQR = async (pair: any) => {
    setSelectedPair(pair);
    try {
      const qrImage = await generateQRCode(pair.vehicle, pair.employee, pair.id);
      setQRCodeImage(qrImage);
      setShowQRModal(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Gagal membuat QR Code');
    }
  };

  const handlePrintQR = () => {
    if (!qrCodeImage) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${selectedPair?.vehicle?.no_polisi}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            img {
              max-width: 300px;
              height: auto;
            }
            .info {
              text-align: center;
              margin-top: 20px;
            }
            .info h2 {
              margin: 5px 0;
            }
            .info p {
              margin: 3px 0;
              color: #666;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <img src="${qrCodeImage}" alt="QR Code" />
          <div class="info">
            <h2>${selectedPair?.vehicle?.no_polisi}</h2>
            <p>${selectedPair?.vehicle?.nama_instansi}</p>
            <p>${selectedPair?.vehicle?.tipe_merk}</p>
            <hr style="width: 200px; margin: 10px 0;">
            <p><strong>${selectedPair?.employee?.nama_lengkap}</strong></p>
            <p>NIP: ${selectedPair?.employee?.nip}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const resetForm = () => {
    setFormData({
      vehicle_id: '',
      employee_id: '',
    });
  };

  const filteredPairs = pairs.filter(
    (p) =>
      p.vehicle?.no_polisi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.employee?.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.employee?.nip.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableVehicles = vehicles.filter(
    (v) => !pairs.some((p: any) => p.vehicle_id === v.id && !p.deleted_at)
  );
  const availableEmployees = employees.filter(
  (e) => !e.deleted_at
);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paket Kendaraan & Sopir</h1>
          <p className="text-gray-600 mt-1">Jodohkan kendaraan dengan sopir utama dan cetak QR Code</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Buat Paket Baru
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari nomor polisi, nama sopir, atau NIP..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">Memuat data...</div>
        ) : filteredPairs.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">Tidak ada paket</div>
        ) : (
          filteredPairs.map((pair) => (
            <div
              key={pair.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <div
                className={`h-2 ${
                  pair.vehicle?.status_qr === 'Terblokir' ? 'bg-red-600' : 'bg-green-600'
                }`}
              />
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-600 font-mono">{pair.qr_code}</span>
                  </div>
                  {pair.vehicle?.status_qr === 'Terblokir' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      Terblokir
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600 font-medium mb-1">KENDARAAN</p>
                    <p className="font-semibold text-gray-900">{pair.vehicle?.no_polisi}</p>
                    <p className="text-sm text-gray-600">{pair.vehicle?.tipe_merk}</p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-600 font-medium mb-1">SOPIR UTAMA</p>
                    <p className="font-semibold text-gray-900">{pair.employee?.nama_lengkap}</p>
                    <p className="text-sm text-gray-600">NIP: {pair.employee?.nip}</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleShowQR(pair)}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    QR Code
                  </button>
                  <button
                    onClick={() => handleDelete(pair.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowModal(false)}
            />
            <div className="inline-block w-full max-w-lg p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Buat Paket Kendaraan & Sopir</h3>

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
                    {availableVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.no_polisi} - {v.tipe_merk} ({v.nama_instansi})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sopir Utama *</label>
                  <select
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Pilih Sopir</option>
                    {availableEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nama_lengkap} - NIP: {e.nip}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Buat Paket
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showQRModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowQRModal(false)}
            />
            <div className="inline-block w-full max-w-md p-6 my-8 text-left align-middle bg-white shadow-xl rounded-2xl relative">
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-6">QR Code Paket Kendaraan</h3>

                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <img src={qrCodeImage} alt="QR Code" className="mx-auto" />
                </div>

                <div className="text-left mb-6 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium text-gray-700">Kendaraan:</span>{' '}
                    <span className="text-gray-900">{selectedPair?.vehicle?.no_polisi}</span>
                  </p>
                  <p className="text-sm">
                    <span className="font-medium text-gray-700">Sopir:</span>{' '}
                    <span className="text-gray-900">{selectedPair?.employee?.nama_lengkap}</span>
                  </p>
                  <p className="text-sm">
                    <span className="font-medium text-gray-700">Kode:</span>{' '}
                    <span className="text-gray-600 font-mono">{selectedPair?.qr_code}</span>
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowQRModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={handlePrintQR}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Cetak QR
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
