ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS credentials_issued_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_agent_credentials_issued(_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ts timestamptz;
BEGIN
  UPDATE public.agent_settings
     SET credentials_issued_at = COALESCE(credentials_issued_at, now()),
         updated_at = now()
   WHERE user_id = _user_id
  RETURNING credentials_issued_at INTO _ts;

  RETURN _ts;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_agent_credentials_issued(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_agent_credentials_issued(uuid) TO service_role;

-- One-time correction: rows stamped activated with no auth sign-in.
UPDATE public.agent_settings s
   SET credentials_issued_at = COALESCE(s.credentials_issued_at, s.account_activated_at),
       account_activated_at = NULL,
       updated_at = now()
  FROM auth.users u
 WHERE u.id = s.user_id
   AND s.account_activated_at IS NOT NULL
   AND u.last_sign_in_at IS NULL;