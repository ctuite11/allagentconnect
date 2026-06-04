CREATE OR REPLACE FUNCTION public.cleanup_blocking_auth_identity(_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  cleaned_count integer := 0;
BEGIN
  WITH removed AS (
    DELETE FROM auth.identities i
    USING auth.users u
    WHERE u.id = i.user_id
      AND lower(coalesce(i.identity_data->>'email', i.email)) = lower(trim(_email))
      AND lower(coalesce(u.email, '')) <> lower(trim(_email))
      AND i.provider = 'email'
    RETURNING 1
  )
  SELECT count(*) INTO cleaned_count FROM removed;

  RETURN cleaned_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_blocking_auth_identity(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_blocking_auth_identity(text) TO service_role;