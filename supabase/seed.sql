-- Seed data for testing

-- Create Super Admin
INSERT INTO users (username, password, role, status_akun) VALUES
('superadmin', 'superadmin123', 'super_admin', 'Aktif');

-- Create Admin Parkir
INSERT INTO users (username, password, role, status_akun) VALUES
('adminparkir', 'admin123', 'admin_parkir', 'Aktif');

-- Create Pegawai (Employee) with user account
INSERT INTO users (username, password, role, status_akun) VALUES
('198001011', 'pegawai123', 'user_pegawai', 'Aktif');

-- Create another pegawai
INSERT INTO users (username, password, role, status_akun) VALUES
('198501022', 'pegawai123', 'user_pegawai', 'Aktif');

-- Create Employees
INSERT INTO employees (nip, nama_lengkap, jabatan_pangkat, no_kontak_wa, user_id) VALUES
('198001011', 'Ahmad Sudirman', 'Sopir Dinas', '081234567890', (SELECT id FROM users WHERE username = '198001011')),
('198501022', 'Budi Santoso', 'Sopir Dinas', '081234567891', (SELECT id FROM users WHERE username = '198501022')),
('199001033', 'Candra Wijaya', 'Staf Administrasi', '081234567892', null),
('199201044', 'Dewi Lestari', 'Kepala Bagian', '081234567893', null);

-- Create Vehicles
INSERT INTO vehicles (no_polisi, nama_instansi, jenis_kendaraan, tipe_merk, kondisi_aset_terakhir, status_qr) VALUES
('DH 8039 WE', 'Dinas Perhubungan', 'Roda 4', 'Toyota Avanza 2020', 'Baik', 'Aktif'),
('DH 8040 WE', 'Dinas Pendidikan', 'Roda 4', 'Honda Mobilio 2019', 'Baik', 'Aktif'),
('DH 1234 AB', 'Sekretariat Daerah', 'Roda 4', 'Toyota Innova 2021', 'Baik', 'Aktif'),
('DH 5678 CD', 'Dinas Kesehatan', 'Ambulans', 'Isuzu Elf Ambulance 2018', 'Baik', 'Aktif'),
('DH 9012 EF', 'Dinas PUPR', 'Truk', 'Mitsubishi L300 2019', 'Rusak Ringan', 'Aktif');

-- Create Vehicle-Driver Pairs with QR Codes
INSERT INTO vehicle_driver_pairs (vehicle_id, employee_id, qr_code, is_primary_driver) VALUES
((SELECT id FROM vehicles WHERE no_polisi = 'DH 8039 WE'), (SELECT id FROM employees WHERE nip = '198001011'), 'QR-DH8039WE-198001011', true),
((SELECT id FROM vehicles WHERE no_polisi = 'DH 8040 WE'), (SELECT id FROM employees WHERE nip = '198501022'), 'QR-DH8040WE-198501022', true);

-- Create sample permits
INSERT INTO permits (employee_id, vehicle_id, start_date, end_date, purpose, status) VALUES
((SELECT id FROM employees WHERE nip = '198001011'), (SELECT id FROM vehicles WHERE no_polisi = 'DH 8039 WE'),
 '2026-05-24 08:00:00+08', '2026-05-24 17:00:00+08', 'Dinas ke Kupang untuk rapat koordinasi', 'Menunggu'),
((SELECT id FROM employees WHERE nip = '198001011'), (SELECT id FROM vehicles WHERE no_polisi = 'DH 8039 WE'),
 '2026-05-17 08:00:00+08', '2026-05-17 12:00:00+08', 'Pengantaran dokumen ke instansi terkait', 'Disetujui');

-- Create sample parking logs
INSERT INTO parking_logs (pair_id, check_in_time, check_out_time, check_in_condition, check_out_condition, status, purpose) VALUES
((SELECT id FROM vehicle_driver_pairs WHERE qr_code = 'QR-DH8039WE-198001011'),
 null,
 '2026-05-23 08:00:00+08',
 'Baik',
 'Baik',
 'Di_Luar_Lahan',
 'Dinas ke kantor dinas'),
((SELECT id FROM vehicle_driver_pairs WHERE qr_code = 'QR-DH8040WE-198501022'),
 null,
 '2026-05-23 09:00:00+08',
 'Baik',
 'Baik',
 'Di_Luar_Lahan',
 'Pengantaran surat ke kecamatan');
