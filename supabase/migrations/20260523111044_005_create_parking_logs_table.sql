/*
  # Create Parking Logs Table

  1. New Tables
    - `parking_logs`
      - `id` (uuid, primary key)
      - `pair_id` (uuid, foreign key to vehicle_driver_pairs)
      - `check_in_time` (timestamp)
      - `check_out_time` (timestamp, nullable)
      - `check_in_condition` (enum: Baik, Rusak Ringan, Rusak Berat)
      - `check_out_condition` (enum: Baik, Rusak Ringan, Rusak Berat)
      - `checked_in_by` (uuid, foreign key to users - admin who checked in)
      - `checked_out_by` (uuid, foreign key to users - admin who checked out)
      - `purpose` (text, nullable - purpose of vehicle usage)
      - `status` (enum: Di_Lahan, Di_Luar_Lahan)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `parking_logs` table
    - Users can read their own logs
    - Admin and super admin can manage all logs
*/

CREATE TYPE parking_status AS ENUM ('Di_Lahan', 'Di_Luar_Lahan');

CREATE TABLE IF NOT EXISTS parking_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES vehicle_driver_pairs(id) ON DELETE CASCADE,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_condition asset_condition NOT NULL DEFAULT 'Baik',
  check_out_condition asset_condition,
  checked_in_by uuid REFERENCES users(id) ON DELETE SET NULL,
  checked_out_by uuid REFERENCES users(id) ON DELETE SET NULL,
  purpose text,
  status parking_status NOT NULL DEFAULT 'Di_Lahan',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE parking_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own parking logs"
  ON parking_logs FOR SELECT
  TO authenticated
  USING (
    pair_id IN (
      SELECT id FROM vehicle_driver_pairs
      WHERE employee_id IN (
        SELECT id FROM employees WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admin and super admin can manage all parking logs"
  ON parking_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin_parkir')
      AND users.status_akun = 'Aktif'
    )
  );

CREATE POLICY "System can insert parking logs"
  ON parking_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_logs_pair ON parking_logs(pair_id);
CREATE INDEX idx_logs_status ON parking_logs(status);
CREATE INDEX idx_logs_check_out_time ON parking_logs(check_out_time);
CREATE INDEX idx_logs_check_in_time ON parking_logs(check_in_time);