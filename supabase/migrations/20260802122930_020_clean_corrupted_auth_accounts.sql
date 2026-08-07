/*
# Fix: Recreate auth accounts properly via Admin API

## Problem
The initial migration (015) created auth.users rows via direct SQL INSERT.
This bypassed GoTrue's internal bookkeeping, corrupting the auth schema.
Login fails with "Database error querying schema" for ALL users.

## Fix
1. Delete all manually-created auth.identities and auth.users rows.
2. Null out public.users.auth_id so the edge function can relink them.
3. The edge function (fix-auth-accounts) will then recreate accounts
   via the Auth Admin API, which goes through GoTrue properly.
*/

-- Clean up: delete all manually-created identities and users from auth schema
DELETE FROM auth.identities;
DELETE FROM auth.users;

-- Reset auth_id in public.users so the edge function can relink
UPDATE public.users SET auth_id = NULL;
