CREATE OR REPLACE FUNCTION public.admin_auth_user_signin_map()
RETURNS TABLE (email text, last_sign_in_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT lower(u.email) AS email, max(u.last_sign_in_at) AS last_sign_in_at
  FROM auth.users u
  WHERE u.email IS NOT NULL AND u.email <> ''
  GROUP BY lower(u.email)
$$;

REVOKE ALL ON FUNCTION public.admin_auth_user_signin_map() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_auth_user_signin_map() FROM anon;
REVOKE ALL ON FUNCTION public.admin_auth_user_signin_map() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_auth_user_signin_map() TO service_role;