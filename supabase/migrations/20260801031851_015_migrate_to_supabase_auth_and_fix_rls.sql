/*
# Migrate to Supabase Auth & enforce role-based RLS

## Background
The app previously used custom client-side auth: plaintext passwords stored in the
public.users table, validated in JavaScript. Because Supabase Auth was never used,
auth.uid() was always NULL, so every RLS policy was set to `true` to allow access.
This effectively disabled row-level security — any anon-key request could read,
insert, update, or delete every row in every table.

## What this migration does

### 1. Auth account creation
- Adds `auth_id` column to public.users (links to auth.users.id).
- Creates a Supabase Auth account for every existing public.users row.
  - email = `<username>@garasi.ttuid` (synthetic domain; the login form
    appends this suffix internally so the UX stays "enter username").
  - password = the existing plaintext password (bcrypt-hashed via crypt()).
  - role stored in raw_app_meta_data (JWT claim, user-immutable).
  - email_confirmed_at set so login works without email confirmation.
- Sets public.users.auth_id to the new auth.users.id.

### 2. Helper functions (Security Invoker, read-only)
- current_user_id()  → public.users.id for the caller (SECURITY DEFINER,
  fixed search_path; only returns the caller's own row).
- current_user_role() → role from JWT app_metadata.
- is_admin()         → true if role is super_admin or admin_parkir.
- is_super_admin()   → true if role is super_admin.
- is_pegawai()       → true if role is user_pegawai.

### 3. RLS policy rewrite — all 8 tables
Old `true` / `FOR ALL` policies are dropped. New per-verb policies:
- users:              read own + admin; write super_admin only
- employees:          read own + admin; write admin only
- vehicles:           read all authenticated; write admin only
- vehicle_driver_pairs: read own + admin; write admin only
- parking_logs:       read own + admin; write admin only
- permits:            full CRUD on own; admin full CRUD
- violations:         read own + admin; write admin only
- password_reset_requests: read own + super_admin; insert own + super_admin;
                           update/delete super_admin only

### 4. Privilege revocation
- REVOKE ALL on every table from anon (no unauthenticated table access).
- GRANT SELECT, INSERT, UPDATE, DELETE on every table to authenticated.

### 5. Important notes
1. The `password` column in public.users is kept (data-safety rule) but is
   no longer used for authentication — passwords now live in auth.users.
2. The login form still accepts a username; AuthContext appends
   `@garasi.ttuid` and calls supabase.auth.signInWithPassword.
3. Password and username changes go through an edge function that uses
   the service role to update auth.users (clients cannot modify auth
   accounts directly).
4. Edge functions (weekend-violation-checker, upload-spt) use the service
   role key, which bypasses RLS — they continue to work unchanged.
*/

-- ──────────────────────────────────────────────
-- 1. Add auth_id column to users
-- ──────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id uuid;

-- ──────────────────────────────────────────────
-- 2. Create Supabase Auth accounts for existing users
-- ──────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
  auth_uuid uuid;
  email_addr text;
BEGIN
  FOR r IN SELECT id, username, password, role FROM public.users WHERE auth_id IS NULL LOOP
    email_addr := r.username || '@garasi.ttuid';

    -- Reuse existing auth account if one already exists for this email
    SELECT id INTO auth_uuid FROM auth.users WHERE email = email_addr;
    IF auth_uuid IS NULL THEN
      auth_uuid := gen_random_uuid();
      INSERT INTO auth.users (
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        instance_id
      )
      VALUES (
        auth_uuid,
        'authenticated',
        'authenticated',
        email_addr,
        crypt(r.password, gen_salt('bf')),
        now(),
        now(),
        now(),
        jsonb_build_object('role', r.role),
        '{}'::jsonb,
        '00000000-0000-0000-0000-000000000000'
      );
    END IF;

    UPDATE public.users SET auth_id = auth_uuid WHERE id = r.id;
  END LOOP;
END $$;

-- ──────────────────────────────────────────────
-- 3. Helper functions
-- ──────────────────────────────────────────────

-- Returns public.users.id for the authenticated caller.
-- SECURITY DEFINER + fixed search_path so it works inside RLS policy
-- evaluation without being blocked by the users table's own RLS.
-- Only returns the caller's own row (filtered by auth.uid()).
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid();
$$;

-- Returns the role claim from the JWT's app_metadata (user-immutable).
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COALESCE(public.current_user_role() IN ('super_admin', 'admin_parkir'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COALESCE(public.current_user_role() = 'super_admin', false);
$$;

CREATE OR REPLACE FUNCTION public.is_pegawai()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COALESCE(public.current_user_role() = 'user_pegawai', false);
$$;

-- ──────────────────────────────────────────────
-- 4. Revoke anon privileges (no unauthenticated table access)
-- ──────────────────────────────────────────────
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.employees FROM anon;
REVOKE ALL ON public.vehicles FROM anon;
REVOKE ALL ON public.vehicle_driver_pairs FROM anon;
REVOKE ALL ON public.parking_logs FROM anon;
REVOKE ALL ON public.permits FROM anon;
REVOKE ALL ON public.violations FROM anon;
REVOKE ALL ON public.password_reset_requests FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_driver_pairs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.violations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_requests TO authenticated;

-- ──────────────────────────────────────────────
-- 5. users — read own + admin; write super_admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow anon update users" ON public.users;
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.users;
DROP POLICY IF EXISTS "Allow anonymous login check" ON public.users;

CREATE POLICY "select_users" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = auth_id OR public.is_admin());

CREATE POLICY "insert_users" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "update_users" ON public.users
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "delete_users" ON public.users
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ──────────────────────────────────────────────
-- 6. employees — read own + admin; write admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow admin to manage employees" ON public.employees;
DROP POLICY IF EXISTS "Allow anonymous read employees" ON public.employees;

CREATE POLICY "select_employees" ON public.employees
  FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = public.current_user_id());

CREATE POLICY "insert_employees" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "update_employees" ON public.employees
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "delete_employees" ON public.employees
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- 7. vehicles — read all authenticated; write admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow admin manage vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Allow anon read vehicles" ON public.vehicles;

CREATE POLICY "select_vehicles" ON public.vehicles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "insert_vehicles" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "update_vehicles" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "delete_vehicles" ON public.vehicles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- 8. vehicle_driver_pairs — read own + admin; write admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow admin manage pairs" ON public.vehicle_driver_pairs;
DROP POLICY IF EXISTS "Allow anon read pairs" ON public.vehicle_driver_pairs;

CREATE POLICY "select_pairs" ON public.vehicle_driver_pairs
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = public.current_user_id())
  );

CREATE POLICY "insert_pairs" ON public.vehicle_driver_pairs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "update_pairs" ON public.vehicle_driver_pairs
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "delete_pairs" ON public.vehicle_driver_pairs
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- 9. parking_logs — read own + admin; write admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow admin manage logs" ON public.parking_logs;
DROP POLICY IF EXISTS "Allow anon read logs" ON public.parking_logs;

CREATE POLICY "select_parking_logs" ON public.parking_logs
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.vehicle_driver_pairs vdp
      WHERE vdp.id = parking_logs.pair_id
        AND vdp.employee_id IN (SELECT id FROM public.employees WHERE user_id = public.current_user_id())
    )
  );

CREATE POLICY "insert_parking_logs" ON public.parking_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "update_parking_logs" ON public.parking_logs
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "delete_parking_logs" ON public.parking_logs
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- 10. permits — full CRUD on own; admin full CRUD
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow admin manage permits" ON public.permits;
DROP POLICY IF EXISTS "Allow anon read permits" ON public.permits;

CREATE POLICY "select_permits" ON public.permits
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = public.current_user_id())
  );

CREATE POLICY "insert_permits" ON public.permits
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = public.current_user_id())
  );

CREATE POLICY "update_permits" ON public.permits
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = public.current_user_id())
  )
  WITH CHECK (
    public.is_admin()
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = public.current_user_id())
  );

CREATE POLICY "delete_permits" ON public.permits
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = public.current_user_id())
  );

-- ──────────────────────────────────────────────
-- 11. violations — read own + admin; write admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow admin manage violations" ON public.violations;
DROP POLICY IF EXISTS "Allow anon read violations" ON public.violations;

CREATE POLICY "select_violations" ON public.violations
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.vehicle_driver_pairs vdp
      WHERE vdp.id = violations.pair_id
        AND vdp.employee_id IN (SELECT id FROM public.employees WHERE user_id = public.current_user_id())
    )
  );

CREATE POLICY "insert_violations" ON public.violations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "update_violations" ON public.violations
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "delete_violations" ON public.violations
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- 12. password_reset_requests — read/insert own + super_admin;
--     update/delete super_admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admin can manage all reset requests" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Users can create own reset requests" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Users can view own reset requests" ON public.password_reset_requests;

CREATE POLICY "select_reset_requests" ON public.password_reset_requests
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR user_id = public.current_user_id()
  );

CREATE POLICY "insert_reset_requests" ON public.password_reset_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR user_id = public.current_user_id()
  );

CREATE POLICY "update_reset_requests" ON public.password_reset_requests
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "delete_reset_requests" ON public.password_reset_requests
  FOR DELETE TO authenticated
  USING (public.is_super_admin());
