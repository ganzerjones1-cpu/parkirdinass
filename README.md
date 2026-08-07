# SIPARKIR - Sistem Manajemen Parkir Terpusat
## Pemerintah Kabupaten Timor Tengah Utara (TTU)

Sistem Informasi Manajemen Parkir Terpusat berbasis Website untuk menegakkan kedisiplinan aset daerah di bawah pengelolaan Satuan Polisi Pamong Praja (Satpol PP).

## Fitur Utama

### 1. Multi-Role Access Control (3 Level)
- **User/Pegawai**: Melihat profil, mengajukan E-Izin, melihat riwayat parkir
- **Admin Parkir**: Scan QR Code, CRUD master data, manajemen paket kendaraan-sopir
- **Super Admin**: Approval E-Izin, Early Warning System, unblock kendaraan, laporan

### 2. QR Code Terpusat
- Satu QR Code Gabungan untuk setiap paket kendaraan + sopir utama
- Pembuatan dan pencetakan QR Code otomatis
- Validasi real-time saat scan di gerbang

### 3. E-Izin (Surat Perintah Tugas Digital)
- Pengajuan izin penggunaan kendaraan di luar jam dinas/hari libur
- Upload dokumen SPT (Surat Perintah Tugas)
- Approval oleh Super Admin

### 4. Early Warning System
- Deteksi otomatis pelanggaran parkir hari libur tanpa izin
- Akumulasi pelanggaran 3x berturut-turut = QR Code Terblokir
- Daftar Merah pelanggaran untuk tindak lanjut

### 5. Reporting & Export
- Laporan log parkir, pelanggaran, E-Izin, dan data kendaraan
- Export ke PDF dan Excel
- Filter berdasarkan periode waktu

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (Mobile-First Design)
- **Database**: Supabase (PostgreSQL)
- **Routing**: React Router v6
- **Icons**: Lucide React
- **QR Code**: html5-qrcode, qrcode
- **Export**: jsPDF, jspdf-autotable, xlsx
- **Dates**: date-fns

## Struktur Database

### Tabel Utama
1. **users** - Akun pengguna (super_admin, admin_parkir, user_pegawai)
2. **vehicles** - Master data kendaraan dinas
3. **employees** - Master data pegawai/sopir
4. **vehicle_driver_pairs** - Paket kendaraan + sopir dengan QR Code
5. **parking_logs** - Log check-in/check-out
6. **permits** - E-Izin penggunaan kendaraan
7. **violations** - Catatan pelanggaran

### Keamanan
- Row Level Security (RLS) di semua tabel
- Soft Delete (deleted_at) untuk preservasi data
- Enkripsi password (BCrypt)

## Demo Account

```
Super Admin: superadmin / superadmin123
Admin Parkir: adminparkir / admin123
Pegawai: 198001011 / pegawai123
```

## Cara Menjalankan

1. Install dependencies:
```bash
npm install
```

2. Setup environment variables (sudah dikonfigurasi):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Jalankan development server:
```bash
npm run dev
```

4. Build untuk production:
```bash
npm run build
```

## Cara Penggunaan

### Untuk Pegawai/Sopir:
1. Login dengan NIP dan password
2. Lihat profil dan data kendaraan dinas
3. Ajukan E-Izin jika akan menggunakan kendaraan di luar jam dinas
4. Pantau status pengajuan izin

### Untuk Admin Parkir:
1. Login dengan username dan password
2. Scan QR Code kendaraan di gerbang
3. Lakukan Check-In atau Check-Out
4. Update kondisi fisik kendaraan
5. Kelola master data kendaraan dan pegawai
6. Buat paket kendaraan-sopir dan cetak QR Code
7. Unduh laporan

### Untuk Super Admin:
1. Review dan approval E-Izin
2. Pantau Daftar Merah pelanggaran
3. Buka blokir kendaraan yang terkena sanksi
4. Akses semua fitur Admin Parkir
5. Unduh laporan untuk dilaporkan ke Bupati/Sekda

## Automated Weekend Violation Detection

Sistem secara otomatis memeriksa pelanggaran setiap Sabtu dan Minggu melalui Edge Function:
- Memindai kendaraan yang statusnya "Di Luar Lahan"
- Memeriksa apakah memiliki E-Izin yang disetujui
- Mencatat pelanggaran jika tidak ada izin
- Mengunci QR Code setelah 3x pelanggaran berturut-turut

Edge Function dapat dijalankan manual atau di-schedule via Supabase.

## Responsive Design

- Mobile-first design untuk petugas gerbang
- Sidebar navigasi responsive
- Tabel dengan horizontal scroll
- Touch-friendly buttons dan forms

## Lisensi

Hak Cipta Pemerintah Kabupaten Timor Tengah Utara
Dikembangkan untuk Satuan Polisi Pamong Praja (Satpol PP) Kab. TTU
