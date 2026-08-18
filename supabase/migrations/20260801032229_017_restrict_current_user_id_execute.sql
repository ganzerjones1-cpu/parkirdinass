/*
# Restrict current_user_id() EXECUTE to authenticated only

PostgreSQL functions default to EXECUTE for PUBLIC, which includes anon.
Revoke from PUBLIC and grant only to authenticated to silence the
SECURITY DEFINER executable-by-anon linter warning.
*/
REVOKE EXECUTE ON FUNCTION public.current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated;
