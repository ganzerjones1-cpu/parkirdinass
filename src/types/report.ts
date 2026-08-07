export interface MonthlyDayData {
  date: Date;
  dayName: string;
  totalKendaraan: number;
  terparkir: number;
  kondisiBaik: number;
  kondisiRusak: number;
  peminjamanJumlah: number;
  peminjamanInstansi: string;
  peminjamanNoPlat: string;
  peminjamanTglPinjam: string;
  peminjamanTglKembali: string;
  peminjamanKet: string;
  tidakTerparkirJumlah: number;
  tidakTerparkirInstansi: string;
  tidakTerparkirNoPlat: string;
  tidakTerparkirKet: string;
}
