/*
  # Create Vehicles (Kendaraan) Table

  1. New Tables
    - `vehicles`
      - `id` (uuid, primary key)
      - `no_polisi` (text, unique - e.g., DH 8039 WE)
      - `nama_instansi` (text)
      - `jenis_kendaraan` (enum: Roda 4, Roda 2, Truk, Ambulans)
      - `tipe_merk` (text)
      - `kondisi_aset_terakhir` (enum: Baik, Rusak Ringan, Rusak Berat)
      - `status_qr` (enum: Aktif, Terblokir)
      - `deleted_at` (timestamp, nullable - for soft delete)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `vehicles` table
    - All authenticated users can read active vehicles
    - Admin and super admin can manage vehicles
*/

CREATE TYPE vehicle_type AS ENUM ('Roda 4', 'Roda 2', 'Truk', 'Ambulans');
CREATE TYPE asset_condition AS ENUM ('Baik', 'Rusak Ringan', 'Rusak Berat');
CREATE TYPE qr_status AS ENUM ('Aktif', 'Terblokir');

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  no_polisi text UNIQUE NOT NULL,
  nama_instansi text NOT NULL,
  jenis_kendaraan vehicle_type NOT NULL,
  tipe_merk text NOT NULL,
  kondisi_aset_terakhir asset_condition NOT NULL DEFAULT 'Baik',
  status_qr qr_status NOT NULL DEFAULT 'Aktif',
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Admin and super admin can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin_parkir')
      AND users.status_akun = 'Aktif'
    )
  );

CREATE POLICY "Admin and super admin can update vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin_parkir')
      AND users.status_akun = 'Aktif'
    )
  );

CREATE POLICY "Admin and super admin can soft delete vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin_parkir')
      AND users.status_akun = 'Aktif'
    )
  );

CREATE INDEX idx_vehicles_no_polisi ON vehicles(no_polisi);
CREATE INDEX idx_vehicles_status ON vehicles(status_qr);
CREATE INDEX idx_vehicles_deleted ON vehicles(deleted_at);