import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, Printer, Filter, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { MonthlyReportTable } from './MonthlyReportTable';
import type { MonthlyDayData } from '../../types/report';

interface VehicleReport {
  id: string;
  no_polisi: string;
  nama_instansi: string;
  kondisi_aset_terakhir: string;
  pairs: Array<{
    id: string;
    employee: {
      nama_lengkap: string;
      nip: string;
      no_kontak_wa: string;
    };
    logs: Array<{
      id: string;
      status: string;
      check_in_time: string;
      check_out_time: string;
      created_at: string;
    }>;
  }>;
}

interface PermitReport {
  id: string;
  vehicle_id: string;
  vehicle: {
    no_polisi: string;
    nama_instansi: string;
    kondisi_aset_terakhir: string;
  };
  employee: {
    nama_lengkap: string;
    no_kontak_wa: string;
  };
  purpose: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface YearlyStats {
  year: number;
  totalKendaraan: number;
  terparkir: number;
  belumTerparkir: number;
  ijinDinas: number;
  pelanggaran: number;
}

type ReportTab = 'daily' | 'monthly' | 'yearly';
type FilterCategory = 'all' | 'parked' | 'not_parked' | 'permits';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function ParkingReport() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [vehicles, setVehicles] = useState<VehicleReport[]>([]);
  const [permits, setPermits] = useState<PermitReport[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyDayData[]>([]);
  const [yearlyStats, setYearlyStats] = useState<YearlyStats[]>([]);
  const [yearlyData, setYearlyData] = useState<Record<number, MonthlyDayData[]>>({});
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [reportTab, setReportTab] = useState<ReportTab>('daily');

  useEffect(() => {
    if (reportTab === 'daily') {
      fetchDailyData();
    } else if (reportTab === 'monthly') {
      fetchMonthlyData();
    } else if (reportTab === 'yearly') {
      fetchYearlyData();
    }
  }, [selectedDate, selectedYear, selectedMonth, reportTab]);

  const fetchDailyData = async () => {
    setLoading(true);
    try {
      const selectedDateStart = new Date(selectedDate);
      selectedDateStart.setHours(0, 0, 0, 0);
      const selectedDateEnd = new Date(selectedDate);
      selectedDateEnd.setHours(23, 59, 59, 999);

      const { data: vehicleData, error: vehicleError } = await supabase
        .from('vehicles')
        .select('*')
        .is('deleted_at', null)
        .order('no_polisi', { ascending: true });

      if (vehicleError) throw vehicleError;

      if (vehicleData && vehicleData.length > 0) {
        const { data: pairsData, error: pairsError } = await supabase
          .from('vehicle_driver_pairs')
          .select(`
            id,
            vehicle_id,
            employee_id,
            employee:employees(nama_lengkap, nip, no_kontak_wa)
          `)
          .in('vehicle_id', vehicleData.map(v => v.id));

        if (pairsError) throw pairsError;

        let logsData: any[] = [];
        if (pairsData && pairsData.length > 0) {
          const { data: fetchedLogs, error: logsError } = await supabase
            .from('parking_logs')
            .select(`
              id,
              pair_id,
              status,
              check_in_time,
              check_out_time,
              created_at
            `)
            .in('pair_id', pairsData.map(p => p.id))
            .gte('created_at', selectedDateStart.toISOString())
            .lte('created_at', selectedDateEnd.toISOString())
            .order('created_at', { ascending: false });

          if (logsError) throw logsError;
          logsData = fetchedLogs || [];
        }

        const vehiclesWithLogs = vehicleData.filter(vehicle => {
          const pairsForVehicle = pairsData?.filter(p => p.vehicle_id === vehicle.id) || [];
          const hasLogsForDate = pairsForVehicle.some(p =>
            logsData.some(l => l.pair_id === p.id)
          );
          return hasLogsForDate;
        });

        const mergedVehicles = vehiclesWithLogs.map(vehicle => ({
          ...vehicle,
          pairs: pairsData
            ?.filter(p => p.vehicle_id === vehicle.id)
            .map(p => ({
              ...p,
              logs: logsData.filter(l => l.pair_id === p.id) || []
            })) || []
        }));

        setVehicles(mergedVehicles as VehicleReport[]);
      } else {
        setVehicles([]);
      }

      const { data: permitData, error: permitError } = await supabase
        .from('permits')
        .select(`
          *,
          vehicle:vehicles(no_polisi, nama_instansi, kondisi_aset_terakhir),
          employee:employees(nama_lengkap, no_kontak_wa)
        `)
        .eq('status', 'Disetujui')
        .lte('start_date', selectedDateEnd.toISOString())
        .gte('end_date', selectedDateStart.toISOString())
        .order('created_at', { ascending: false });

      if (permitError) throw permitError;

      setPermits(permitData || []);
    } catch (error) {
      console.error('Error fetching daily data:', error);
      toast.error('Gagal memuat data laporan');
    } finally {
      setLoading(false);
    }
  };

  const buildMonthlyData = async (year: number, month: number): Promise<MonthlyDayData[]> => {
    const monthDate = new Date(year, month, 1);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const { data: vehicleData } = await supabase
      .from('vehicles')
      .select('*')
      .is('deleted_at', null)
      .order('no_polisi', { ascending: true });

    const { data: pairsData } = await supabase
      .from('vehicle_driver_pairs')
      .select('id, vehicle_id')
      .in('vehicle_id', vehicleData?.map(v => v.id) || []);

    const { data: logsData } = await supabase
      .from('parking_logs')
      .select('id, pair_id, status, check_in_time, check_out_time, created_at')
      .in('pair_id', pairsData?.map(p => p.id) || [])
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString())
      .order('created_at', { ascending: false });

    const { data: permitsData } = await supabase
      .from('permits')
      .select(`
        id, purpose, start_date, end_date, status,
        vehicle:vehicles(no_polisi, nama_instansi, kondisi_aset_terakhir),
        employee:employees(nama_lengkap, no_kontak_wa)
      `)
      .eq('status', 'Disetujui')
      .lte('start_date', monthEnd.toISOString())
      .gte('end_date', monthStart.toISOString())
      .order('created_at', { ascending: false });

    const dayDataList: MonthlyDayData[] = allDays
      .map(day => {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        const dayLogs = (logsData || []).filter(l => {
          const logDate = new Date(l.created_at);
          return logDate >= dayStart && logDate <= dayEnd;
        });

        const pairIdsWithLogs = new Set(dayLogs.map(l => l.pair_id));
        const vehicleIdsWithLogs = new Set(
          (pairsData || []).filter(p => pairIdsWithLogs.has(p.id)).map(p => p.vehicle_id)
        );
        const vehiclesToday = (vehicleData || []).filter(v => vehicleIdsWithLogs.has(v.id));

        const terparkirPairs = new Set(
          dayLogs
            .filter(l => l.status === 'Di_Lahan' && l.check_in_time && !l.check_out_time)
            .map(l => l.pair_id)
        );
        const terparkirCount = (pairsData || []).filter(p => terparkirPairs.has(p.id)).length;

        const kondisiBaik = vehiclesToday.filter(v => v.kondisi_aset_terakhir === 'Baik').length;
        const kondisiRusak = vehiclesToday.filter(v => v.kondisi_aset_terakhir === 'Rusak').length;

        const dayPermits = (permitsData || []).filter(p => {
          const pStart = new Date(p.start_date);
          const pEnd = new Date(p.end_date);
          return pStart <= dayEnd && pEnd >= dayStart;
        });

        const tidakTerparkirVehicles = vehiclesToday.filter(v => {
          const vPairs = (pairsData || []).filter(p => p.vehicle_id === v.id);
          const vLogs = dayLogs.filter(l => vPairs.some(p => p.id === l.pair_id));
          const hasActiveParking = vLogs.some(l => l.status === 'Di_Lahan' && l.check_in_time && !l.check_out_time);
          return !hasActiveParking;
        });

        return {
          date: day,
          dayName: format(day, 'EEEE', { locale: id }),
          totalKendaraan: vehiclesToday.length,
          terparkir: terparkirCount,
          kondisiBaik,
          kondisiRusak,
          peminjamanJumlah: dayPermits.length,
          peminjamanInstansi: dayPermits.map(p => p.vehicle?.nama_instansi).join(', '),
          peminjamanNoPlat: dayPermits.map(p => p.vehicle?.no_polisi).join(', '),
          peminjamanTglPinjam: dayPermits.map(p => format(new Date(p.start_date), 'dd/MM/yyyy')).join(', '),
          peminjamanTglKembali: dayPermits.map(p => format(new Date(p.end_date), 'dd/MM/yyyy')).join(', '),
          peminjamanKet: dayPermits.map(p => p.purpose?.substring(0, 15)).join(', '),
          tidakTerparkirJumlah: tidakTerparkirVehicles.length,
          tidakTerparkirInstansi: tidakTerparkirVehicles.map(v => v.nama_instansi).join(', '),
          tidakTerparkirNoPlat: tidakTerparkirVehicles.map(v => v.no_polisi).join(', '),
          tidakTerparkirKet: tidakTerparkirVehicles.length > 0 ? 'Belum Terparkir' : '',
        };
      })
      .filter(day => day.totalKendaraan > 0 || day.peminjamanJumlah > 0);

    return dayDataList;
  };

  const fetchMonthlyData = async () => {
    setLoading(true);
    try {
      const dayDataList = await buildMonthlyData(selectedYear, selectedMonth);
      setMonthlyData(dayDataList);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
      toast.error('Gagal memuat data laporan bulanan');
    } finally {
      setLoading(false);
    }
  };

  const fetchYearlyData = async () => {
    setLoading(true);
    try {
      const allMonthData: Record<number, MonthlyDayData[]> = {};
      for (let m = 0; m < 12; m++) {
        allMonthData[m] = await buildMonthlyData(selectedYear, m);
      }
      setYearlyData(allMonthData);

      const stats: YearlyStats[] = [];
      const currentYear = new Date().getFullYear();

      for (let year = currentYear; year >= currentYear - 4; year--) {
        const yearStart = startOfYear(new Date(year, 0, 1));
        const yearEnd = endOfYear(new Date(year, 11, 31));

        const { data: logsData } = await supabase
          .from('parking_logs')
          .select('id, status, check_in_time, check_out_time')
          .gte('created_at', yearStart.toISOString())
          .lte('created_at', yearEnd.toISOString());

        const { data: permitsData } = await supabase
          .from('permits')
          .select('id, status')
          .eq('status', 'Disetujui')
          .gte('start_date', yearStart.toISOString())
          .lte('end_date', yearEnd.toISOString());

        const { data: violationsData } = await supabase
          .from('violations')
          .select('id')
          .gte('violation_date', yearStart.toISOString())
          .lte('violation_date', yearEnd.toISOString());

        const terparkir = logsData?.filter(l => l.status === 'Di_Lahan' && l.check_in_time && !l.check_out_time).length || 0;
        const logsCount = logsData?.length || 0;

        const { data: uniquePairs } = await supabase
          .from('parking_logs')
          .select('pair_id', { count: 'exact' })
          .gte('created_at', yearStart.toISOString())
          .lte('created_at', yearEnd.toISOString());

        const uniqueVehicles = uniquePairs?.length || 0;

        stats.push({
          year,
          totalKendaraan: uniqueVehicles,
          terparkir: terparkir,
          belumTerparkir: logsCount - terparkir,
          ijinDinas: permitsData?.length || 0,
          pelanggaran: violationsData?.length || 0,
        });
      }

      setYearlyStats(stats);
    } catch (error) {
      console.error('Error fetching yearly data:', error);
      toast.error('Gagal memuat data laporan tahunan');
    } finally {
      setLoading(false);
    }
  };

  const getCheckInStatus = (vehicle: VehicleReport) => {
    const primaryPair = vehicle.pairs?.[0];
    const latestLog = primaryPair?.logs?.[0];
    if (!latestLog) return 'BELUM TERPARKIR';
    if (latestLog.check_in_time && !latestLog.check_out_time) return 'SUDAH TERPARKIR';
    if (latestLog.check_out_time) return 'BELUM TERPARKIR';
    return 'BELUM TERPARKIR';
  };

  const getFilteredData = () => {
    switch (filterCategory) {
      case 'parked':
        return vehicles.filter(v => getCheckInStatus(v) === 'SUDAH TERPARKIR');
      case 'not_parked':
        return vehicles.filter(v => getCheckInStatus(v) === 'BELUM TERPARKIR');
      case 'permits':
        return [];
      case 'all':
      default:
        return vehicles;
    }
  };

  const getDriverInfo = (vehicle: VehicleReport) => {
    const primaryPair = vehicle.pairs?.[0];
    return {
      name: primaryPair?.employee?.nama_lengkap || '-',
      phone: primaryPair?.employee?.no_kontak_wa || '-',
    };
  };

  const calculateYearlyTotals = () => {
    return yearlyStats.reduce(
      (acc, stat) => ({
        totalKendaraan: acc.totalKendaraan + stat.totalKendaraan,
        terparkir: acc.terparkir + stat.terparkir,
        belumTerparkir: acc.belumTerparkir + stat.belumTerparkir,
        ijinDinas: acc.ijinDinas + stat.ijinDinas,
        pelanggaran: acc.pelanggaran + stat.pelanggaran,
      }),
      { totalKendaraan: 0, terparkir: 0, belumTerparkir: 0, ijinDinas: 0, pelanggaran: 0 }
    );
  };

  const exportToPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 15;

    const logoSize = 18;
    const logoX = (pageWidth / 2) - 45;
    const logoY = yPos - 4;
    try {
      const logoResp = await fetch('/logo-login.png');
      if (logoResp.ok) {
        const logoBlob = await logoResp.blob();
        const logoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(logoBlob);
        });
        doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
      }
    } catch {
      // abaikan jika logo gagal dimuat
    }

    doc.setFontSize(14);
    doc.text('PEMERINTAH KABUPATEN TIMOR TENGAH UTARA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    doc.setFontSize(12);
    doc.text('SATUAN POLISI PAMONG PRAJA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;

    doc.setFontSize(10);
    doc.text('Jalan Basuki Rahmad - Kel Benpasi', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    doc.setLineWidth(0.5);
    doc.line(14, yPos - 4, pageWidth - 14, yPos - 4);
    yPos += 2;

    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('DAFTAR PARKIR KENDARAAN DINAS PEMKAB. TTU', pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Hari/Tanggal: ${format(new Date(selectedDate), 'EEEE, dd MMMM yyyy', { locale: id })}`, 14, yPos);
    yPos += 10;

    const mainTableData = vehicles.map((v, idx) => [
      String(idx + 1),
      v.nama_instansi,
      v.no_polisi,
      v.kondisi_aset_terakhir,
      getDriverInfo(v).name,
      getDriverInfo(v).phone,
      format(new Date(selectedDate), 'dd/MM/yyyy'),
      getCheckInStatus(v),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['No.', 'Nama Instansi', 'No. Polisi', 'Kondisi Parkir', 'Nama Sopir', 'No. Kontak', 'Tanggal', 'Keterangan']],
      body: mainTableData,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'center' }, 3: { halign: 'center' }, 7: { halign: 'center' } },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    if (permits.length > 0) {
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text('IJIN DINAS', 14, yPos);
      yPos += 7;

      const permitTableData = permits.map((p, idx) => [
        String(idx + 1),
        p.vehicle.nama_instansi,
        p.vehicle.no_polisi,
        p.vehicle.kondisi_aset_terakhir,
        p.employee.nama_lengkap,
        p.employee.no_kontak_wa,
        format(new Date(p.start_date), 'dd/MM/yyyy'),
        p.purpose.substring(0, 20),
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['No.', 'Nama Instansi', 'No. Polisi', 'Kondisi', 'Nama Sopir', 'No. Kontak', 'Tanggal', 'Keperluan']],
        body: permitTableData,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'center' }, 3: { halign: 'center' } },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    yPos += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('KETERANGAN:', 14, yPos);
    yPos += 6;

    const parkedCount = vehicles.filter(v => getCheckInStatus(v) === 'SUDAH TERPARKIR').length;
    const notParkedCount = vehicles.filter(v => getCheckInStatus(v) === 'BELUM TERPARKIR').length;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(`Jumlah Kendaraan yang terparkir: ${parkedCount}`, 14, yPos);
    yPos += 5;
    doc.text(`Kendaraan Ijin: ${permits.length}`, 14, yPos);
    yPos += 5;
    doc.text(`Kendaraan Tanpa Informasi: ${notParkedCount}`, 14, yPos);
    yPos += 5;
    doc.text(`Total Kendaraan: ${vehicles.length}`, 14, yPos);

    yPos = pageHeight - 35;
    doc.setFontSize(10);
    doc.text('PETUGAS PENERIMA PARKIR,', pageWidth - 50, yPos);
    yPos += 20;
    doc.text('...................................................', pageWidth - 50, yPos);

    doc.save(`laporan_parkir_${selectedDate}.pdf`);
    toast.success('Laporan PDF berhasil diunduh');
  };

  const exportMonthlyPDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 15;

    const logoSize = 18;
    const logoLeftX = 14;
    const logoRightX = pageWidth - 32;
    const logoY = yPos - 4;
    try {
      const logoResp = await fetch('/logo-login.png');
      if (logoResp.ok) {
        const logoBlob = await logoResp.blob();
        const logoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(logoBlob);
        });
        doc.addImage(logoDataUrl, 'PNG', logoLeftX, logoY, logoSize, logoSize);
        doc.addImage(logoDataUrl, 'PNG', logoRightX, logoY, logoSize, logoSize);
      }
    } catch {
      // abaikan jika logo gagal dimuat
    }

    doc.setFontSize(13);
    doc.text('PEMERINTAH KABUPATEN TIMOR TENGAH UTARA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.setFontSize(11);
    doc.text('SATUAN POLISI PAMONG PRAJA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.setFontSize(9);
    doc.text('Jalan Basuki Rahmad - Kel Benpasi', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.setFontSize(8);
    doc.text('Email: satpolpp_ttu@yahoo.co.id', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    doc.setLineWidth(0.8);
    doc.line(14, yPos - 3, pageWidth - 14, yPos - 3);
    doc.setLineWidth(0.3);
    doc.line(14, yPos - 1.5, pageWidth - 14, yPos - 1.5);
    yPos += 4;

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`REKAPITULASI PARKIR KENDARAAN DINAS PEMKAB. TTU`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`BULAN ${MONTH_NAMES[selectedMonth].toUpperCase()} ${selectedYear}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    const tableData = monthlyData.map((d, idx) => [
      String(idx + 1),
      `${d.dayName}\n${format(d.date, 'dd/MM/yyyy')}`,
      String(d.totalKendaraan),
      String(d.terparkir),
      String(d.kondisiBaik),
      String(d.kondisiRusak),
      String(d.peminjamanJumlah),
      d.peminjamanInstansi || '-',
      d.peminjamanNoPlat || '-',
      d.peminjamanTglPinjam || '-',
      d.peminjamanTglKembali || '-',
      d.peminjamanKet || '-',
      String(d.tidakTerparkirJumlah),
      d.tidakTerparkirInstansi || '-',
      d.tidakTerparkirNoPlat || '-',
      d.tidakTerparkirKet || '-',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [[
        'No.', 'Hari/Tanggal', 'Jumlah\nKendaraan', 'Jumlah\nTerparkir',
        'Baik', 'Rusak', 'Jumlah', 'Instansi', 'No.Plat', 'Tgl Pinjam', 'Tgl Kembali', 'Ket.',
        'Jumlah', 'Instansi', 'No.Plat', 'Ket.'
      ]],
      body: tableData,
      styles: { fontSize: 6, cellPadding: 1.5, valign: 'top', lineColor: [0, 0, 0], lineWidth: 0.2 },
      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', fontSize: 6, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 22 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'center', cellWidth: 12 },
        5: { halign: 'center', cellWidth: 12 },
        6: { halign: 'center', cellWidth: 12 },
        7: { cellWidth: 25 },
        8: { cellWidth: 22 },
        9: { cellWidth: 18 },
        10: { cellWidth: 18 },
        11: { cellWidth: 18 },
        12: { halign: 'center', cellWidth: 12 },
        13: { cellWidth: 25 },
        14: { cellWidth: 22 },
        15: { cellWidth: 18 },
      },
      didParseCell: (data) => {
        if (data.section === 'head') {
          data.cell.styles.fillColor = [220, 220, 220];
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('PETUGAS PENERIMA PARKIR,', pageWidth - 55, yPos);
    yPos += 20;
    doc.text('...................................................', pageWidth - 55, yPos);

    doc.save(`laporan_bulanan_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`);
    toast.success('Laporan PDF berhasil diunduh');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Laporan Parkir Kendaraan Dinas</h1>
        <p className="text-gray-600 mt-1">Format sesuai dokumen resmi PEMKAB TTU</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setReportTab('daily')}
            className={`flex-1 px-6 py-3 font-medium text-center transition-colors ${
              reportTab === 'daily'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Laporan Harian
          </button>
          <button
            onClick={() => setReportTab('monthly')}
            className={`flex-1 px-6 py-3 font-medium text-center transition-colors ${
              reportTab === 'monthly'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Laporan Bulanan
          </button>
          <button
            onClick={() => setReportTab('yearly')}
            className={`flex-1 px-6 py-3 font-medium text-center transition-colors ${
              reportTab === 'yearly'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Laporan Tahunan
          </button>
        </div>

        <div className="p-6">
          {/* Daily Report */}
          {reportTab === 'daily' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Tanggal</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3 items-end">
                  <button
                    onClick={exportToPDF}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Unduh PDF
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak
                  </button>
                </div>
              </div>

              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2 pb-4 border-b print:hidden">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filter:
                </span>
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Semua ({vehicles.length})
                </button>
                <button
                  onClick={() => setFilterCategory('parked')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterCategory === 'parked'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Sudah Terparkir ({vehicles.filter(v => getCheckInStatus(v) === 'SUDAH TERPARKIR').length})
                </button>
                <button
                  onClick={() => setFilterCategory('not_parked')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterCategory === 'not_parked'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Belum Terparkir ({vehicles.filter(v => getCheckInStatus(v) === 'BELUM TERPARKIR').length})
                </button>
                <button
                  onClick={() => setFilterCategory('permits')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterCategory === 'permits'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Ijin Dinas ({permits.length})
                </button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-600">Memuat data...</div>
              ) : (
                <div className="space-y-8 print:space-y-6">
                  {/* Header Laporan */}
                  <div className="flex items-center gap-2 border-b-2 border-black pb-2">
                    <img
                      src="/logo-login.png"
                      alt="Logo Satpol PP TTU"
                      className="w-16 h-16 object-contain shrink-0"
                    />
                    <div className="text-center flex-1 space-y-1">
                      <p className="text-sm font-semibold">PEMERINTAH KABUPATEN TIMOR TENGAH UTARA</p>
                      <p className="text-sm font-semibold">SATUAN POLISI PAMONG PRAJA</p>
                      <p className="text-xs text-gray-600">Jalan Basuki Rahmad - Kel Benpasi</p>
                      <p className="text-sm font-bold mt-1">DAFTAR PARKIR KENDARAAN DINAS PEMKAB. TTU</p>
                      <p className="text-sm">
                        Hari/Tanggal: {format(new Date(selectedDate), 'EEEE, dd MMMM yyyy', { locale: id })}
                      </p>
                    </div>
                    <div className="w-20 shrink-0 hidden sm:block" aria-hidden />
                  </div>

                  {/* Main Table */}
                  {filterCategory !== 'permits' && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-800">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-800 px-2 py-2 text-xs font-bold w-8">No.</th>
                          <th className="border border-gray-800 px-2 py-2 text-xs font-bold">Nama Instansi</th>
                          <th className="border border-gray-800 px-2 py-2 text-xs font-bold">No. Polisi</th>
                          <th className="border border-gray-800 px-2 py-2 text-xs font-bold">Kondisi Parkir</th>
                          <th colSpan={4} className="border border-gray-800 px-2 py-2 text-xs font-bold text-center">
                            PENYERAHAN MOBIL
                          </th>
                        </tr>
                        <tr className="bg-gray-100">
                          <th colSpan={4} className="border border-gray-800 px-2 py-1"></th>
                          <th className="border border-gray-800 px-2 py-1 text-xs font-bold">NAMA</th>
                          <th className="border border-gray-800 px-2 py-1 text-xs font-bold">NO. KONTAK</th>
                          <th className="border border-gray-800 px-2 py-1 text-xs font-bold">Tanggal</th>
                          <th className="border border-gray-800 px-2 py-1 text-xs font-bold">KET</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFilteredData().map((vehicle, idx) => {
                          const driver = getDriverInfo(vehicle);
                          const status = getCheckInStatus(vehicle);
                          return (
                            <tr key={vehicle.id} className="hover:bg-gray-50">
                              <td className="border border-gray-800 px-2 py-2 text-xs text-center font-medium">
                                {idx + 1}
                              </td>
                              <td className="border border-gray-800 px-2 py-2 text-xs">{vehicle.nama_instansi}</td>
                              <td className="border border-gray-800 px-2 py-2 text-xs font-medium">{vehicle.no_polisi}</td>
                              <td className="border border-gray-800 px-2 py-2 text-xs text-center">
                                {vehicle.kondisi_aset_terakhir}
                              </td>
                              <td className="border border-gray-800 px-2 py-2 text-xs">{driver.name}</td>
                              <td className="border border-gray-800 px-2 py-2 text-xs">{driver.phone}</td>
                              <td className="border border-gray-800 px-2 py-2 text-xs text-center">
                                {format(new Date(selectedDate), 'dd/MM/yyyy')}
                              </td>
                              <td className="border border-gray-800 px-2 py-2 text-xs text-center font-semibold text-blue-700">
                                {status}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {getFilteredData().length === 0 && (
                      <div className="text-center py-8 text-gray-600">
                        Tidak ada data untuk filter yang dipilih
                      </div>
                    )}
                  </div>
                  )}

                  {/* Permits Section */}
                  {filterCategory !== 'parked' && filterCategory !== 'not_parked' && permits.length > 0 && (
                    <div className="space-y-4 mt-8">
                      <h3 className="text-sm font-bold">IJIN DINAS</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-800">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-800 px-2 py-2 text-xs font-bold w-8">No.</th>
                              <th className="border border-gray-800 px-2 py-2 text-xs font-bold">Nama Instansi</th>
                              <th className="border border-gray-800 px-2 py-2 text-xs font-bold">No. Polisi</th>
                              <th className="border border-gray-800 px-2 py-2 text-xs font-bold">Kondisi</th>
                              <th colSpan={4} className="border border-gray-800 px-2 py-2 text-xs font-bold text-center">
                                PENYERAHAN MOBIL
                              </th>
                            </tr>
                            <tr className="bg-gray-100">
                              <th colSpan={4} className="border border-gray-800 px-2 py-1"></th>
                              <th className="border border-gray-800 px-2 py-1 text-xs font-bold">NAMA</th>
                              <th className="border border-gray-800 px-2 py-1 text-xs font-bold">NO. KONTAK</th>
                              <th className="border border-gray-800 px-2 py-1 text-xs font-bold">Tanggal</th>
                              <th className="border border-gray-800 px-2 py-1 text-xs font-bold">KEPERLUAN</th>
                            </tr>
                          </thead>
                          <tbody>
                            {permits.map((permit, idx) => (
                              <tr key={permit.id} className="hover:bg-gray-50">
                                <td className="border border-gray-800 px-2 py-2 text-xs text-center font-medium">
                                  {idx + 1}
                                </td>
                                <td className="border border-gray-800 px-2 py-2 text-xs">{permit.vehicle.nama_instansi}</td>
                                <td className="border border-gray-800 px-2 py-2 text-xs font-medium">
                                  {permit.vehicle.no_polisi}
                                </td>
                                <td className="border border-gray-800 px-2 py-2 text-xs text-center">
                                  {permit.vehicle.kondisi_aset_terakhir}
                                </td>
                                <td className="border border-gray-800 px-2 py-2 text-xs">{permit.employee.nama_lengkap}</td>
                                <td className="border border-gray-800 px-2 py-2 text-xs">{permit.employee.no_kontak_wa}</td>
                                <td className="border border-gray-800 px-2 py-2 text-xs text-center">
                                  {format(new Date(permit.start_date), 'dd/MM/yyyy')}
                                </td>
                                <td className="border border-gray-800 px-2 py-2 text-xs">{permit.purpose}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {filterCategory === 'all' && (
                  <div className="mt-8 space-y-4">
                    <h3 className="text-sm font-bold">KETERANGAN:</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p>
                          Jumlah Kendaraan yang terparkir:{' '}
                          <strong>
                            {vehicles.filter(v => getCheckInStatus(v) === 'SUDAH TERPARKIR').length}
                          </strong>
                        </p>
                        <p>
                          Kendaraan Ijin: <strong>{permits.length}</strong>
                        </p>
                      </div>
                      <div>
                        <p>
                          Kendaraan Tanpa Informasi:{' '}
                          <strong>
                            {vehicles.filter(v => getCheckInStatus(v) === 'BELUM TERPARKIR').length}
                          </strong>
                        </p>
                        <p>
                          Total Kendaraan: <strong>{vehicles.length}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Signature */}
                  <div className="mt-12 text-right">
                    <p className="text-sm font-semibold mb-12">PETUGAS PENERIMA PARKIR,</p>
                    <p className="text-sm">...................................................</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Monthly Report */}
          {reportTab === 'monthly' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 print:hidden">
                <div className="w-full sm:w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Bulan</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {MONTH_NAMES.map((month, idx) => (
                      <option key={idx} value={idx}>{month}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Tahun</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 items-end flex-1 justify-end">
                  <button
                    onClick={exportMonthlyPDF}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Unduh PDF
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-600">Memuat data...</div>
              ) : monthlyData.length === 0 ? (
                <div className="text-center py-12 text-gray-600 bg-gray-50 rounded-lg">
                  Tidak ada data parkir pada bulan {MONTH_NAMES[selectedMonth]} {selectedYear}
                </div>
              ) : (
                <MonthlyReportTable
                  data={monthlyData}
                  monthName={MONTH_NAMES[selectedMonth]}
                  year={selectedYear}
                />
              )}
            </div>
          )}

          {/* Yearly Report */}
          {reportTab === 'yearly' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 print:hidden">
                <div className="w-full sm:w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Tahun</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 items-end flex-1 justify-end">
                  <button
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-600">Memuat data...</div>
              ) : (
                <div className="space-y-12">
                  {MONTH_NAMES.map((monthName, m) => {
                    const monthData = yearlyData[m] || [];
                    return (
                      <div key={m} className="bg-white border border-gray-200 rounded-lg p-6">
                        <MonthlyReportTable
                          data={monthData}
                          monthName={monthName}
                          year={selectedYear}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
