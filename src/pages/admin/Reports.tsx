import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  FileSpreadsheet,
  File,
  Edit2,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ReportsCRUDModal } from './ReportsCRUD';

type ReportType = 'parking_logs' | 'violations' | 'permits' | 'vehicles';
type ParkingStatus = 'all' | 'Di_Lahan' | 'Di_Luar_Lahan';

export function Reports() {
  const [reportType, setReportType] = useState<ReportType>('vehicles');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [parkingStatus, setParkingStatus] = useState<ParkingStatus>('all');
  const [crudModal, setCrudModal] = useState<{ isOpen: boolean; mode: 'edit' | 'delete' | null; data: any }>({
    isOpen: false,
    mode: null,
    data: null,
  });

  useEffect(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      let query: any;
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      switch (reportType) {
        case 'parking_logs':
          query = supabase
            .from('parking_logs')
            .select(
              `
              *,
              pair:vehicle_driver_pairs (
                vehicle:vehicles (no_polisi, nama_instansi, tipe_merk),
                employee:employees (nama_lengkap, nip)
              )
            `
            )
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .order('created_at', { ascending: false });
          break;

        case 'violations':
          query = supabase
            .from('violations')
            .select(
              `
              *,
              pair:vehicle_driver_pairs (
                vehicle:vehicles (no_polisi, nama_instansi),
                employee:employees (nama_lengkap, nip)
              )
            `
            )
            .gte('violation_date', start.toISOString())
            .lte('violation_date', end.toISOString())
            .order('violation_date', { ascending: false });
          break;

        case 'permits':
          query = supabase
            .from('permits')
            .select(
              `
              *,
              vehicle:vehicles (no_polisi, nama_instansi),
              employee:employees (nama_lengkap, nip)
            `
            )
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .order('created_at', { ascending: false });
          break;

        case 'vehicles':
          query = supabase
            .from('vehicles')
            .select(`
              *,
              pairs:vehicle_driver_pairs(
                id,
                employee:employees(nama_lengkap, nip, no_kontak_wa),
                logs:parking_logs(
                  id,
                  status,
                  check_in_time,
                  check_out_time,
                  created_at
                )
              )
            `)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          break;
      }

      const { data: result, error } = await query;
      if (error) throw error;
      setData(result || []);
      toast.success(`${result?.length || 0} data ditemukan`);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const title = getReportTitle();

    doc.setFontSize(18);
    doc.text(title, 14, 20);

    doc.setFontSize(10);
    doc.text(`Periode: ${format(new Date(startDate), 'dd MMMM yyyy', { locale: id })} - ${format(new Date(endDate), 'dd MMMM yyyy', { locale: id })}`, 14, 28);
    doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 14, 34);

    let yPos = 45;

    switch (reportType) {
      case 'parking_logs':
        autoTable(doc, {
          startY: yPos,
          head: [['Tanggal', 'Kendaraan', 'Sopir', 'Status', 'Masuk', 'Keluar', 'Kondisi']],
          body: data.map((log) => [
            format(new Date(log.created_at), 'dd/MM/yyyy HH:mm'),
            log.pair?.vehicle?.no_polisi || '-',
            log.pair?.employee?.nama_lengkap || '-',
            log.status,
            log.check_in_time ? format(new Date(log.check_in_time), 'HH:mm') : '-',
            log.check_out_time ? format(new Date(log.check_out_time), 'HH:mm') : '-',
            log.check_out_condition || log.check_in_condition || '-',
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [37, 99, 235] },
        });
        break;

      case 'violations':
        autoTable(doc, {
          startY: yPos,
          head: [['Tanggal', 'Kendaraan', 'Sopir', 'Jenis', 'Pelanggaran Ke-', 'Berturut']],
          body: data.map((v) => [
            format(new Date(v.violation_date), 'dd/MM/yyyy'),
            v.pair?.vehicle?.no_polisi || '-',
            v.pair?.employee?.nama_lengkap || '-',
            v.violation_type.replace(/_/g, ' '),
            v.consecutive_count,
            v.is_consecutive ? 'Ya' : 'Tidak',
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [220, 38, 38] },
        });
        break;

      case 'permits':
        autoTable(doc, {
          startY: yPos,
          head: [['Tanggal', 'Pemohon', 'Kendaraan', 'Periode', 'Keperluan', 'Status']],
          body: data.map((p) => [
            format(new Date(p.created_at), 'dd/MM/yyyy'),
            p.employee?.nama_lengkap || '-',
            p.vehicle?.no_polisi || '-',
            `${format(new Date(p.start_date), 'dd/MM')} - ${format(new Date(p.end_date), 'dd/MM/yyyy')}`,
            p.purpose.substring(0, 30) + (p.purpose.length > 30 ? '...' : ''),
            p.status,
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [37, 99, 235] },
        });
        break;

      case 'vehicles':
        autoTable(doc, {
          startY: yPos,
          head: [['No. Polisi', 'Instansi', 'Tipe/Merk', 'Jenis', 'Kondisi', 'Status QR', 'Sopir', 'No. WA']],
          body: data.map((v) => {
            // Get driver info from pairs
            const primaryPair = v.pairs?.find((p: any) => p.employee);
            const driverName = primaryPair?.employee?.nama_lengkap || '-';
            const driverWa = primaryPair?.employee?.no_kontak_wa || '-';

            return [
              v.no_polisi,
              v.nama_instansi,
              v.tipe_merk,
              v.jenis_kendaraan,
              v.kondisi_aset_terakhir,
              v.status_qr,
              driverName,
              driverWa,
            ];
          }),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [37, 99, 235] },
        });
        break;
    }

    doc.save(`${reportType}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    toast.success('Laporan PDF berhasil diunduh');
  };

  const exportToExcel = () => {
    let worksheetData: any[][] = [];
    const headers: string[] = [];

    switch (reportType) {
      case 'parking_logs':
        headers.push('Tanggal', 'Kendaraan', 'Instansi', 'Sopir', 'NIP', 'Status', 'Check-In', 'Check-Out', 'Kondisi Masuk', 'Kondisi Keluar', 'Keperluan');
        data.forEach((log) => {
          worksheetData.push([
            format(new Date(log.created_at), 'dd/MM/yyyy HH:mm'),
            log.pair?.vehicle?.no_polisi || '-',
            log.pair?.vehicle?.nama_instansi || '-',
            log.pair?.employee?.nama_lengkap || '-',
            log.pair?.employee?.nip || '-',
            log.status,
            log.check_in_time ? format(new Date(log.check_in_time), 'dd/MM/yyyy HH:mm') : '-',
            log.check_out_time ? format(new Date(log.check_out_time), 'dd/MM/yyyy HH:mm') : '-',
            log.check_in_condition || '-',
            log.check_out_condition || '-',
            log.purpose || '-',
          ]);
        });
        break;

      case 'violations':
        headers.push('Tanggal', 'Kendaraan', 'Instansi', 'Sopir', 'NIP', 'Jenis Pelanggaran', 'Pelanggaran Ke-', 'Berturut-turut');
        data.forEach((v) => {
          worksheetData.push([
            format(new Date(v.violation_date), 'dd/MM/yyyy HH:mm'),
            v.pair?.vehicle?.no_polisi || '-',
            v.pair?.vehicle?.nama_instansi || '-',
            v.pair?.employee?.nama_lengkap || '-',
            v.pair?.employee?.nip || '-',
            v.violation_type.replace(/_/g, ' '),
            v.consecutive_count,
            v.is_consecutive ? 'Ya' : 'Tidak',
          ]);
        });
        break;

      case 'permits':
        headers.push('Tanggal Pengajuan', 'Pemohon', 'NIP', 'Kendaraan', 'Instansi', 'Tanggal Mulai', 'Tanggal Selesai', 'Keperluan', 'Status', 'Alasan Penolakan');
        data.forEach((p) => {
          worksheetData.push([
            format(new Date(p.created_at), 'dd/MM/yyyy HH:mm'),
            p.employee?.nama_lengkap || '-',
            p.employee?.nip || '-',
            p.vehicle?.no_polisi || '-',
            p.vehicle?.nama_instansi || '-',
            format(new Date(p.start_date), 'dd/MM/yyyy HH:mm'),
            format(new Date(p.end_date), 'dd/MM/yyyy HH:mm'),
            p.purpose,
            p.status,
            p.rejection_reason || '-',
          ]);
        });
        break;

      case 'vehicles':
        headers.push('No. Polisi', 'Instansi', 'Tipe/Merk', 'Jenis Kendaraan', 'Kondisi', 'Status QR', 'Nama Sopir', 'No. WA', 'Tanggal Dibuat');
        data.forEach((v) => {
          // Get driver info from pairs
          const primaryPair = v.pairs?.find((p: any) => p.employee);
          const driverName = primaryPair?.employee?.nama_lengkap || '-';
          const driverWa = primaryPair?.employee?.no_kontak_wa || '-';

          worksheetData.push([
            v.no_polisi,
            v.nama_instansi,
            v.tipe_merk,
            v.jenis_kendaraan,
            v.kondisi_aset_terakhir,
            v.status_qr,
            driverName,
            driverWa,
            format(new Date(v.created_at), 'dd/MM/yyyy'),
          ]);
        });
        break;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...worksheetData]);
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
    XLSX.writeFile(wb, `${reportType}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    toast.success('Laporan Excel berhasil diunduh');
  };

  const getReportTitle = () => {
    switch (reportType) {
      case 'parking_logs':
        return 'LAPORAN LOG PARKIR';
      case 'violations':
        return 'LAPORAN PELANGGARAN';
      case 'permits':
        return 'LAPORAN E-IZIN';
      case 'vehicles':
        return 'LAPORAN DATA KENDARAAN';
      default:
        return 'LAPORAN';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Laporan & Ekspor</h1>
        <p className="text-gray-600 mt-1">Unduh laporan dalam format PDF atau Excel</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Laporan</label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as ReportType);
                setData([]);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="vehicles">Data Kendaraan</option>
              <option value="parking_logs">Log Parkir</option>
              <option value="violations">Pelanggaran</option>
              <option value="permits">E-Izin</option>
            </select>
          </div>

          {reportType === 'vehicles' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status Parkir</label>
              <select
                value={parkingStatus}
                onChange={(e) => setParkingStatus(e.target.value as ParkingStatus)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Semua</option>
                <option value="Di_Lahan">Di Lahan</option>
                <option value="Di_Luar_Lahan">Di Luar Lahan</option>
              </select>
            </div>
          )}

          {reportType !== 'vehicles' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Selesai</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          )}

          <div className="flex items-end">
            <button
              onClick={fetchData}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
          </div>
        </div>

        {data.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={exportToPDF}
              className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Unduh PDF
            </button>
            <button
              onClick={exportToExcel}
              className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Unduh Excel
            </button>
          </div>
        )}
      </div>

      {data.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Hasil Laporan ({data.length} data)</h2>
          </div>

          <div className="overflow-x-auto">
            {reportType === 'parking_logs' && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kendaraan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sopir</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kondisi</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.slice(0, 50).map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{format(new Date(log.created_at), 'dd/MM HH:mm')}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{log.pair?.vehicle?.no_polisi}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.pair?.employee?.nama_lengkap}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          log.status === 'Di_Lahan' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.check_out_condition || log.check_in_condition}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setCrudModal({ isOpen: true, mode: 'edit', data: log })}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setCrudModal({ isOpen: true, mode: 'delete', data: log })}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'violations' && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kendaraan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sopir</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ke-</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.slice(0, 50).map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{format(new Date(v.violation_date), 'dd/MM/yyyy')}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{v.pair?.vehicle?.no_polisi}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{v.pair?.employee?.nama_lengkap}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                          v.consecutive_count >= 3 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {v.consecutive_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setCrudModal({ isOpen: true, mode: 'edit', data: v })}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setCrudModal({ isOpen: true, mode: 'delete', data: v })}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'permits' && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pemohon</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kendaraan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Keperluan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.slice(0, 50).map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{p.employee?.nama_lengkap}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.vehicle?.no_polisi}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.purpose.substring(0, 40)}...</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          p.status === 'Disetujui' ? 'bg-green-100 text-green-700' :
                          p.status === 'Ditolak' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setCrudModal({ isOpen: true, mode: 'edit', data: p })}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setCrudModal({ isOpen: true, mode: 'delete', data: p })}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'vehicles' && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">No. Polisi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Instansi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tipe/Merk</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sopir</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">No. WA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status Parkir</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kondisi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status QR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.slice(0, 50).map((v) => {
                    const primaryPair = v.pairs?.[0];
                    const driverName = primaryPair?.employee?.nama_lengkap || '-';
                    const driverNip = primaryPair?.employee?.nip || '-';
                    const driverWa = primaryPair?.employee?.no_kontak_wa || '-';

                    // Get latest log status
                    const latestLog = primaryPair?.logs?.[0];
                    let currentStatus = 'Di Luar Lahan';
                    if (latestLog && latestLog.check_in_time && !latestLog.check_out_time) {
                      currentStatus = 'Di Lahan';
                    }

                    // Filter by status
                    if (parkingStatus !== 'all') {
                      const targetStatus = parkingStatus === 'Di_Lahan' ? 'Di Lahan' : 'Di Luar Lahan';
                      if (currentStatus !== targetStatus) return null;
                    }

                    return (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{v.no_polisi}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{v.nama_instansi}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{v.tipe_merk}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{driverName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {driverWa !== '-' ? (
                            <a
                              href={`https://wa.me/${driverWa.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:text-green-700 font-medium"
                            >
                              {driverWa}
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            currentStatus === 'Di Lahan' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {currentStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            v.kondisi_aset_terakhir === 'Baik' ? 'bg-green-100 text-green-700' :
                            v.kondisi_aset_terakhir === 'Rusak Ringan' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {v.kondisi_aset_terakhir}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            v.status_qr === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {v.status_qr}
                          </span>
                        </td>
                      </tr>
                    );
                  }).filter(Boolean)}
                </tbody>
              </table>
            )}
          </div>

          {data.length > 50 && (
            <div className="px-6 py-4 bg-gray-50 text-center text-sm text-gray-600">
              Menampilkan 50 data pertama dari {data.length} total data. Unduh laporan untuk melihat seluruh data.
            </div>
          )}
        </div>
      )}

      <ReportsCRUDModal
        isOpen={crudModal.isOpen}
        mode={crudModal.mode}
        data={crudModal.data}
        reportType={reportType}
        onClose={() => setCrudModal({ isOpen: false, mode: null, data: null })}
        onSuccess={fetchData}
      />
    </div>
  );
}
