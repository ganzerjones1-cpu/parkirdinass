/*
  # Add Profile Photo Column to Users Table

  1. Changes
    - Add foto column to users table for storing profile photo URL
*/

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS foto TEXT DEFAULT '';

COMMENT ON COLUMN users.foto IS 'URL foto profil user';
