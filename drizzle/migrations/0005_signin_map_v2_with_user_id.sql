CREATE OR REPLACE FUNCTION public.admin_auth_user_signin_map_v2()
RETURNS TABLE(user_id uuid, email text, last_sign_in_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT u.id AS user_id, lower(u.email) AS email, u.last_sign_in_at
  FROM auth.users u
  WHERE u.email IS NOT NULL AND u.email <> ''
$function$;

REVOKE ALL ON FUNCTION public.admin_auth_user_signin_map_v2() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_auth_user_signin_map_v2() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_auth_user_signin_map_v2() TO service_role;