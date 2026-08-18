/*
  # Create Violations Table

  1. New Tables
    - `violations`
      - `id` (uuid, primary key)
      - `pair_id` (uuid, foreign key to vehicle_driver_pairs)
      - `parking_log_id` (uuid, foreign key to parking_logs)
      - `violation_date` (timestamp - the date of the violation)
      - `violation_type` (enum: Parkir_Libur_Tanpa_Izin, etc.)
      - `week_number` (integer - week number of the year)
      - `is_consecutive` (boolean - if this is part of consecutive violations)
      - `consecutive_count` (integer - number of consecutive violations)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on `violations` table
    - Admin and super admin can manage all violations
*/

CREATE TYPE violation_type AS ENUM ('Parkir_Libur_Tanpa_Izin', 'Keterlambatan_Kembali', 'Pelanggaran_Lain');

CREATE TABLE IF NOT EXISTS violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES vehicle_driver_pairs(id) ON DELETE CASCADE,
  parking_log_id uuid REFERENCES parking_logs(id) ON DELETE SET NULL,
  violation_date timestamptz NOT NULL,
  violation_type violation_type NOT NULL DEFAULT 'Parkir_Libur_Tanpa_Izin',
  week_number integer NOT NULL,
  is_consecutive boolean DEFAULT false,
  consecutive_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and super admin can manage violations"
  ON violations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin_parkir')
      AND users.status_akun = 'Aktif'
    )
  );

CREATE INDEX idx_violations_pair ON violations(pair_id);
CREATE INDEX idx_violations_date ON violations(violation_date);
CREATE INDEX idx_violations_week ON violations(week_number);
CREATE INDEX idx_violations_consecutive ON violations(is_consecutive, consecutive_count);