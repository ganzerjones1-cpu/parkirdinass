/*
# Fix: Restore soft-deleted pegawai data + create user for Rio Fatin

## Issues found
1. Employee "Budi Santoso" (NIP 198501022) was soft-deleted, and so was their
   vehicle_driver_pair. The user account still exists and can login, but sees
   no data because the app filters on deleted_at IS NULL.
2. Employee "Rio Fatin" (NIP 200108032025051004) has an employee record and a
   vehicle_driver_pair, but no user account — so they cannot login at all.

## What this migration does
1. Restores (un-soft-deletes) the employee record for Budi Santoso.
2. Restores (un-soft-deletes) the vehicle_driver_pair for Budi Santoso.
3. Creates a Supabase Auth account for Rio Fatin (user_pegawai role).
4. Creates a public.users row for Rio Fatin, linked to the new auth account.
5. Links the existing employee record to the new user account.
*/

-- ──────────────────────────────────────────────
-- 1. Restore soft-deleted employee for Budi Santoso
-- ──────────────────────────────────────────────
UPDATE public.employees
SET deleted_at = NULL
WHERE nip = '198501022' AND deleted_at IS NOT NULL;

-- ──────────────────────────────────────────────
-- 2. Restore soft-deleted vehicle_driver_pair for Budi Santoso
-- ──────────────────────────────────────────────
UPDATE public.vehicle_driver_pairs
SET deleted_at = NULL
WHERE qr_code = 'QR-DH8040WE-198501022' AND deleted_at IS NOT NULL;

-- ──────────────────────────────────────────────
-- 3. Create auth account for Rio Fatin (NIP 200108032025051004)
-- ──────────────────────────────────────────────
DO $$
DECLARE
  rio_auth_id uuid;
  rio_user_id uuid;
  rio_email text;
BEGIN
  rio_email := '200108032025051004@garasi.ttuid';

  -- Check if auth account already exists
  SELECT id INTO rio_auth_id FROM auth.users WHERE email = rio_email;

  -- Create auth account if it doesn't exist
  IF rio_auth_id IS NULL THEN
    rio_auth_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, instance_id
    )
    VALUES (
      rio_auth_id,
      'authenticated',
      'authenticated',
      rio_email,
      crypt('pegawai123', gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('role', 'user_pegawai'),
      '{}'::jsonb,
      '00000000-0000-0000-0000-000000000000'
    );

    -- Create auth.identities row (required for login to work)
    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    )
    VALUES (
      rio_email,
      rio_auth_id,
      jsonb_build_object(
        'sub', rio_auth_id::text,
        'email', rio_email,
        'email_verified', true
      ),
      'email',
      NULL,
      now(),
      now()
    );
  END IF;

  -- Check if public.users row already exists
  SELECT id INTO rio_user_id FROM public.users WHERE username = '200108032025051004';

  -- Create public.users row if it doesn't exist
  IF rio_user_id IS NULL THEN
    INSERT INTO public.users (username, password, role, status_akun, auth_id)
    VALUES ('200108032025051004', 'pegawai123', 'user_pegawai', 'Aktif', rio_auth_id)
    RETURNING id INTO rio_user_id;
  ELSE
    -- Update existing row with auth_id if missing
    UPDATE public.users SET auth_id = rio_auth_id WHERE id = rio_user_id AND auth_id IS NULL;
  END IF;

  -- Link employee record to this user account
  UPDATE public.employees
  SET user_id = rio_user_id
  WHERE nip = '200108032025051004' AND user_id IS NULL;
END $$;
