/*
  # Create Vehicle-Driver Pairings Table

  1. New Tables
    - `vehicle_driver_pairs`
      - `id` (uuid, primary key)
      - `vehicle_id` (uuid, foreign key to vehicles)
      - `employee_id` (uuid, foreign key to employees)
      - `qr_code` (text, unique - the combined QR code string)
      - `is_primary_driver` (boolean - indicates if this is the primary driver)
      - `active_until` (timestamp, nullable)
      - `deleted_at` (timestamp, nullable - for soft delete)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `vehicle_driver_pairs` table
    - Users can read their own pairings
    - Admin and super admin can manage all pairings
*/

CREATE TABLE IF NOT EXISTS vehicle_driver_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  qr_code text UNIQUE NOT NULL,
  is_primary_driver boolean DEFAULT true,
  active_until timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(vehicle_id, employee_id)
);

ALTER TABLE vehicle_driver_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pairings"
  ON vehicle_driver_pairs FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
    OR deleted_at IS NULL
  );

CREATE POLICY "Admin and super admin can manage pairings"
  ON vehicle_driver_pairs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin_parkir')
      AND users.status_akun = 'Aktif'
    )
  );

CREATE INDEX idx_pairs_vehicle ON vehicle_driver_pairs(vehicle_id);
CREATE INDEX idx_pairs_employee ON vehicle_driver_pairs(employee_id);
CREATE INDEX idx_pairs_qr ON vehicle_driver_pairs(qr_code);
CREATE INDEX idx_pairs_deleted ON vehicle_driver_pairs(deleted_at);