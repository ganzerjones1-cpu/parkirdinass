/*
  # Create Users and Roles Table

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `username` (text, unique - NIP for employees, username for admin)
      - `password` (text, hashed)
      - `role` (enum: super_admin, admin_parkir, user_pegawai)
      - `status_akun` (enum: Aktif, Non-Aktif)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `users` table
    - Add policies for authenticated users to read their own data
    - Super admin can read all users
*/

CREATE TYPE user_role AS ENUM ('super_admin', 'admin_parkir', 'user_pegawai');
CREATE TYPE account_status AS ENUM ('Aktif', 'Non-Aktif');

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  role user_role NOT NULL DEFAULT 'user_pegawai',
  status_akun account_status NOT NULL DEFAULT 'Aktif',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Super admin can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Users can update own password"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);