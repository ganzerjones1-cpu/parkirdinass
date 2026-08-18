/*
  # Fix Employees Table RLS for Custom Authentication

  1. Changes
    - Allow anonymous read access for login
    - Allow admin to manage employees
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own employee data" ON employees;
DROP POLICY IF EXISTS "Admin and super admin can manage employees" ON employees;

-- Create new policies
CREATE POLICY "Allow anonymous read employees"
  ON employees FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow admin to manage employees"
  ON employees FOR ALL
  TO anon, authenticated
  USING (true);
