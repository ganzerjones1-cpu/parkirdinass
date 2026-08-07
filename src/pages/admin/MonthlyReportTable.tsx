import React from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import type { MonthlyDayData } from '../types/report';

interface MonthlyReportTableProps {
  data: MonthlyDayData[];
  monthName: string;
  year: number;
}

export function MonthlyReportTable({ data, monthName, year }: MonthlyReportTableProps) {
  return (
    <div className="space-y-4">
      {/* Kop Surat */}
      <div className="flex items-center gap-4 border-b-[3px] border-black pb-2">
        <img
          src="/logo-login.png"
          alt="Logo TTU"
          className="w-20 h-20 object-contain shrink-0"
        />
        <div className="text-center flex-1 space-y-0.5">
          <p className="text-sm font-bold">PEMERINTAH KABUPATEN TIMOR TENGAH UTARA</p>
          <p className="text-sm font-bold">SATUAN POLISI PAMONG PRAJA</p>
          <p className="text-xs text-gray-700">Jalan Basuki Rahmad - Kel Benpasi</p>
          <p className="text-xs text-gray-700">Email: satpolpp_ttu@yahoo.co.id</p>
        </div>
        <img
          src="/logo-satpol-pp.png"
          alt="Logo Satpol PP"
          className="w-20 h-20 object-contain shrink-0"
        />
      </div>

      {/* Title */}
      <div className="text-center">
        <p className="text-sm font-bold">REKAPITULASI PARKIR KENDARAAN DINAS PEMKAB. TTU</p>
        <p className="text-sm font-bold">BULAN {monthName.toUpperCase()} {year}</p>
      </div>

      {/* Complex Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr>
              <th colSpan={16} className="border border-black px-2 py-2 text-center font-bold bg-gray-200">
                ({monthName.toUpperCase()})
              </th>
            </tr>
            <tr className="bg-gray-100">
              <th rowSpan={3} className="border border-black px-1 py-1 text-center font-bold w-8">No.</th>
              <th rowSpan={3} className="border border-black px-1 py-1 text-center font-bold min-w-[100px]">Hari/Tanggal</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">Jumlah Kendaraan</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">Jumlah Kendaraan Terparkir</th>
              <th colSpan={2} className="border border-black px-1 py-1 text-center font-bold">Kondisi Kendaraan</th>
              <th colSpan={6} className="border border-black px-1 py-1 text-center font-bold">Peminjaman Kendaraan</th>
              <th colSpan={4} className="border border-black px-1 py-1 text-center font-bold">Kendaraan Tidak Terparkir</th>
            </tr>
            <tr className="bg-gray-100">
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">Baik</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">Rusak</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">Jumlah</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">Instansi</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">No.Plat</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">Tgl Pinjam</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">Tgl Kembali</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">Ket.</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">Jumlah</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">Instansi</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">No.Plat</th>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold">Ket.</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={16} className="border border-black px-2 py-6 text-center text-gray-500">
                  Tidak ada data parkir pada bulan ini
                </td>
              </tr>
            ) : (
              data.map((day, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
                  <td className="border border-black px-1 py-1 whitespace-nowrap">
                    {day.dayName}<br />{format(day.date, 'dd/MM/yyyy')}
                  </td>
                  <td className="border border-black px-1 py-1 text-center">{day.totalKendaraan}</td>
                  <td className="border border-black px-1 py-1 text-center">{day.terparkir}</td>
                  <td className="border border-black px-1 py-1 text-center">{day.kondisiBaik}</td>
                  <td className="border border-black px-1 py-1 text-center">{day.kondisiRusak}</td>
                  <td className="border border-black px-1 py-1 text-center">{day.peminjamanJumlah}</td>
                  <td className="border border-black px-1 py-1 text-xs">{day.peminjamanInstansi || '-'}</td>
                  <td className="border border-black px-1 py-1 text-xs">{day.peminjamanNoPlat || '-'}</td>
                  <td className="border border-black px-1 py-1 text-center text-xs">{day.peminjamanTglPinjam || '-'}</td>
                  <td className="border border-black px-1 py-1 text-center text-xs">{day.peminjamanTglKembali || '-'}</td>
                  <td className="border border-black px-1 py-1 text-xs">{day.peminjamanKet || '-'}</td>
                  <td className="border border-black px-1 py-1 text-center">{day.tidakTerparkirJumlah}</td>
                  <td className="border border-black px-1 py-1 text-xs">{day.tidakTerparkirInstansi || '-'}</td>
                  <td className="border border-black px-1 py-1 text-xs">{day.tidakTerparkirNoPlat || '-'}</td>
                  <td className="border border-black px-1 py-1 text-xs">{day.tidakTerparkirKet || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Signature */}
      <div className="mt-8 text-right">
        <p className="text-sm font-semibold mb-12">PETUGAS PENERIMA PARKIR,</p>
        <p className="text-sm">...................................................</p>
      </div>
    </div>
  );
}
