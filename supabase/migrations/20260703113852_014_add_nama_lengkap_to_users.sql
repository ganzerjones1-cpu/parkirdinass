/*
  # Add nama_lengkap column to users table
  
  Allows all roles (admin_parkir, super_admin, user_pegawai) to save their
  display name directly on the users record, independent of the employees table.
*/

ALTER TABLE users
ADD COLUMN IF NOT EXISTS nama_lengkap TEXT DEFAULT '';
