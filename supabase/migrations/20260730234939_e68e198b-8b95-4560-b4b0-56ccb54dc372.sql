
CREATE OR REPLACE FUNCTION public.mark_agent_activated(_user_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _now timestamptz := now();
  _existing timestamptz;
  _is_agent boolean;
  _caller uuid := auth.uid();
  _jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), (current_setting('request.jwt.claims', true)::json ->> 'role'), '');
  _privileged boolean;
  _status text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  _privileged := _caller IS NULL OR _jwt_role = 'service_role' OR public.has_role(_caller, 'admin');

  -- Non-privileged callers may only activate themselves.
  IF NOT _privileged AND _caller IS DISTINCT FROM _user_id THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'agent'
  ) INTO _is_agent;

  IF NOT _is_agent THEN
    RETURN NULL;
  END IF;

  SELECT agent_status INTO _status FROM public.agent_settings WHERE user_id = _user_id;

  -- Self-activation requires an admin-granted verified/invited status.
  IF NOT _privileged AND coalesce(_status, 'pending') NOT IN ('verified', 'invited') THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.agent_settings (user_id, account_activated_at, updated_at)
  VALUES (_user_id, _now, _now)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.agent_settings
     SET account_activated_at = _now,
         updated_at = _now
   WHERE user_id = _user_id
     AND account_activated_at IS NULL;

  UPDATE public.agent_settings
     SET agent_status = 'verified',
         verified_at = COALESCE(verified_at, _now),
         updated_at = _now
   WHERE user_id = _user_id
     AND agent_status = 'invited';

  SELECT account_activated_at INTO _existing
    FROM public.agent_settings WHERE user_id = _user_id;
  RETURN _existing;
END;
$function$;
