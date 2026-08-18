/*
  # Create E-Permits (E-Izin) Table

  1. New Tables
    - `permits`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key to employees)
      - `vehicle_id` (uuid, foreign key to vehicles)
      - `start_date` (timestamp)
      - `end_date` (timestamp)
      - `purpose` (text)
      - `spt_document_url` (text - URL to uploaded SPT document)
      - `status` (enum: Menunggu, Disetujui, Ditolak)
      - `approved_by` (uuid, foreign key to users - super admin who approved)
      - `rejection_reason` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `permits` table
    - Users can read and create their own permits
    - Super admin can approve/reject permits
    - Admin can read permits (for scan validation)
*/

CREATE TYPE permit_status AS ENUM ('Menunggu', 'Disetujui', 'Ditolak');

CREATE TABLE IF NOT EXISTS permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  purpose text NOT NULL,
  spt_document_url text,
  status permit_status NOT NULL DEFAULT 'Menunggu',
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE permits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own permits"
  ON permits FOR ALL
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admin can approve permits"
  ON permits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
      AND users.status_akun = 'Aktif'
    )
  );

CREATE POLICY "Admin can read all permits"
  ON permits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin_parkir')
      AND users.status_akun = 'Aktif'
    )
  );

CREATE INDEX idx_permits_employee ON permits(employee_id);
CREATE INDEX idx_permits_vehicle ON permits(vehicle_id);
CREATE INDEX idx_permits_status ON permits(status);
CREATE INDEX idx_permits_dates ON permits(start_date, end_date);