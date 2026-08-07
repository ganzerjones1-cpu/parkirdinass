/*
  # Fix RLS for All Tables to Allow Anonymous Access

  1. Changes
    - Allow anonymous read access for all public tables
    - This is needed for the custom authentication system
*/

-- Vehicles
DROP POLICY IF EXISTS "Authenticated users can read active vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin and super admin can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin and super admin can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin and super admin can soft delete vehicles" ON vehicles;

CREATE POLICY "Allow anon read vehicles"
  ON vehicles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow admin manage vehicles"
  ON vehicles FOR ALL
  TO anon, authenticated
  USING (true);

-- Vehicle Driver Pairs
DROP POLICY IF EXISTS "Users can read own pairings" ON vehicle_driver_pairs;
DROP POLICY IF EXISTS "Admin and super admin can manage pairings" ON vehicle_driver_pairs;

CREATE POLICY "Allow anon read pairs"
  ON vehicle_driver_pairs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow admin manage pairs"
  ON vehicle_driver_pairs FOR ALL
  TO anon, authenticated
  USING (true);

-- Parking Logs
DROP POLICY IF EXISTS "Users can read own parking logs" ON parking_logs;
DROP POLICY IF EXISTS "Admin and super admin can manage all parking logs" ON parking_logs;
DROP POLICY IF EXISTS "System can insert parking logs" ON parking_logs;

CREATE POLICY "Allow anon read logs"
  ON parking_logs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow admin manage logs"
  ON parking_logs FOR ALL
  TO anon, authenticated
  USING (true);

-- Permits
DROP POLICY IF EXISTS "Users can manage own permits" ON permits;
DROP POLICY IF EXISTS "Super admin can approve permits" ON permits;
DROP POLICY IF EXISTS "Admin can read all permits" ON permits;

CREATE POLICY "Allow anon read permits"
  ON permits FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow admin manage permits"
  ON permits FOR ALL
  TO anon, authenticated
  USING (true);

-- Violations
DROP POLICY IF EXISTS "Admin and super admin can manage violations" ON violations;

CREATE POLICY "Allow anon read violations"
  ON violations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow admin manage violations"
  ON violations FOR ALL
  TO anon, authenticated
  USING (true);
