/*
# Fix: Create missing auth.identities records

The initial migration (015) created auth.users rows directly via INSERT,
but did not insert corresponding rows into auth.identities. Supabase Auth's
login flow queries auth.identities and returns "Database error querying
schema" when no identity is found for the user.

This migration inserts the missing email identity records for every
auth.users row that lacks one. The `email` column in auth.identities is
a generated column, so it is excluded from the INSERT.
*/
INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  a.email,
  a.id,
  jsonb_build_object(
    'sub', a.id::text,
    'email', a.email,
    'email_verified', true
  ),
  'email',
  a.last_sign_in_at,
  a.created_at,
  a.updated_at
FROM auth.users a
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = a.id
);
