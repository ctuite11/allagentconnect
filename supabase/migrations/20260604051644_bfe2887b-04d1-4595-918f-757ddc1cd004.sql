CREATE OR REPLACE FUNCTION public.cleanup_blocking_auth_identity(_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  repaired_count integer := 0;
BEGIN
  WITH repaired AS (
    UPDATE auth.identities i
    SET
      email = u.email,
      identity_data = jsonb_set(
        coalesce(i.identity_data, '{}'::jsonb),
        '{email}',
        to_jsonb(u.email),
        true
      ),
      updated_at = now()
    FROM auth.users u
    WHERE u.id = i.user_id
      AND lower(coalesce(i.identity_data->>'email', i.email)) = lower(trim(_email))
      AND lower(coalesce(u.email, '')) <> lower(trim(_email))
      AND u.email IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO repaired_count FROM repaired;

  RETURN repaired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_blocking_auth_identity(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_blocking_auth_identity(text) TO service_role;