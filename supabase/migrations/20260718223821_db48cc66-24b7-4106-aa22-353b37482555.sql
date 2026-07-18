
-- Canonical activation writer. Called by every agent account-creation /
-- password-setup path so activation is a property of "successfully created
-- an account", not "which email brought them here".
CREATE OR REPLACE FUNCTION public.mark_agent_activated(_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
  _existing timestamptz;
  _is_agent boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Only agents get activated. Non-agents are a no-op.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'agent'
  ) INTO _is_agent;

  IF NOT _is_agent THEN
    RETURN NULL;
  END IF;

  -- Ensure agent_settings row exists.
  INSERT INTO public.agent_settings (user_id, account_activated_at, updated_at)
  VALUES (_user_id, _now, _now)
  ON CONFLICT (user_id) DO NOTHING;

  -- Idempotent stamp: only fill when null.
  UPDATE public.agent_settings
     SET account_activated_at = _now,
         updated_at = _now
   WHERE user_id = _user_id
     AND account_activated_at IS NULL
  RETURNING account_activated_at INTO _existing;

  -- Flip invited → verified on first activation, never downgrade.
  UPDATE public.agent_settings
     SET agent_status = 'verified',
         verified_at = COALESCE(verified_at, _now),
         updated_at = _now
   WHERE user_id = _user_id
     AND agent_status = 'invited';

  -- Return the authoritative activation timestamp (original or just-set).
  SELECT account_activated_at INTO _existing
    FROM public.agent_settings WHERE user_id = _user_id;
  RETURN _existing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_agent_activated(uuid) TO authenticated, service_role;

-- Backfill: any agent whose auth account is already usable
-- (password set + at least one sign-in) but whose activation timestamp
-- is null should converge to the new canonical rule.
UPDATE public.agent_settings s
   SET account_activated_at = COALESCE(u.last_sign_in_at, u.confirmed_at, u.created_at, now()),
       updated_at = now()
  FROM auth.users u
  JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'agent'
 WHERE s.user_id = u.id
   AND s.account_activated_at IS NULL
   AND u.encrypted_password IS NOT NULL
   AND u.last_sign_in_at IS NOT NULL;

-- Same backfill: flip invited → verified for those newly-activated rows.
UPDATE public.agent_settings
   SET agent_status = 'verified',
       verified_at = COALESCE(verified_at, account_activated_at),
       updated_at = now()
 WHERE agent_status = 'invited'
   AND account_activated_at IS NOT NULL;
