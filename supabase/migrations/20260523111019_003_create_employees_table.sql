/*
  # Create Employees (Pegawai) Table

  1. New Tables
    - `employees`
      - `id` (uuid, primary key)
      - `nip` (text, unique)
      - `nama_lengkap` (text)
      - `jabatan_pangkat` (text)
      - `no_kontak_wa` (text)
      - `user_id` (uuid, foreign key to users - links employee to user account)
      - `deleted_at` (timestamp, nullable - for soft delete)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `employees` table
    - Users can read their own employee data
    - Admin and super admin can manage all employees
*/

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nip text UNIQUE NOT NULL,
  nama_lengkap text NOT NULL,
  jabatan_pangkat text NOT NULL,
  no_kontak_wa text,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own employee data"
  ON employees FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR deleted_at IS NULL);

CREATE POLICY "Admin and super admin can manage employees"
  ON employees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin_parkir')
      AND users.status_akun = 'Aktif'
    )
  );

CREATE INDEX idx_employees_nip ON employees(nip);
CREATE INDEX idx_employees_user ON employees(user_id);
CREATE INDEX idx_employees_deleted ON employees(deleted_at);