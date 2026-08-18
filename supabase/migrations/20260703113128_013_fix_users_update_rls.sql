/*
  # Fix Users Table UPDATE RLS for Custom Authentication
  
  The app uses a custom auth system (not Supabase Auth), so auth.uid() is always null.
  The previous UPDATE policy blocked all profile updates including foto.
  This migration replaces it with a policy that allows anon users to update.
*/

DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Allow users to update own data" ON users;

CREATE POLICY "Allow anon update users"
  ON users FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
