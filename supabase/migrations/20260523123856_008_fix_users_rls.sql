/*
  # Fix Users Table RLS for Custom Authentication

  1. Changes
    - Add policy for users table to allow anonymous login check
    - This is needed because we're using custom auth, not Supabase Auth
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Super admin can read all users" ON users;
DROP POLICY IF EXISTS "Users can update own password" ON users;

-- Create new policies that work with anon key
CREATE POLICY "Allow anonymous login check"
  ON users FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow insert for anon (for registration if needed)
CREATE POLICY "Allow anonymous insert"
  ON users FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
