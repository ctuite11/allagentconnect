CREATE OR REPLACE FUNCTION public.cleanup_orphan_auth_identity(_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  WITH del AS (
    DELETE FROM auth.identities i
    WHERE lower(i.identity_data->>'email') = lower(_email)
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = i.user_id)
    RETURNING 1
  )
  SELECT count(*) INTO deleted_count FROM del;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_orphan_auth_identity(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_orphan_auth_identity(text) TO service_role;