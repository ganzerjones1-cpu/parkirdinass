/*
# Harden helper functions: fixed search_path + restrict EXECUTE

## Changes
1. All helper functions get `SET search_path = public` to prevent search_path
   injection (addresses 4 function_search_path_mutable warnings).
2. REVOKE EXECUTE on current_user_id() from anon (it's a SECURITY DEFINER
   function — only authenticated users should call it).
3. GRANT EXECUTE on current_user_id() to authenticated only.

The SECURITY INVOKER functions (current_user_role, is_admin, is_super_admin,
is_pegawai) also get a fixed search_path. They don't access any tables so
search_path injection is not exploitable, but the linter flags them anyway
and fixing it is best practice.
*/

-- Fix search_path on all helper functions
ALTER FUNCTION public.current_user_id() SET search_path = public;
ALTER FUNCTION public.current_user_role() SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.is_super_admin() SET search_path = public;
ALTER FUNCTION public.is_pegawai() SET search_path = public;

-- Restrict EXECUTE on the SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.current_user_id() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated;
