-- Helper: is this an API (PostgREST/GoTrue) request rather than a trusted direct DB session?
CREATE OR REPLACE FUNCTION public.is_api_request()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(current_setting('request.jwt.claims', true), '') <> ''
      OR coalesce(current_setting('request.jwt.claim.role', true), '') <> ''
      OR coalesce(current_setting('request.method', true), '') <> '';
$$;

REVOKE ALL ON FUNCTION public.is_api_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_api_request() TO authenticated, service_role;

-- Hardened activation RPC: anonymous/missing-user API requests are never privileged.
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
  _api boolean := public.is_api_request();
  _privileged boolean;
  _status text;
BEGIN
  -- Fail closed: anonymous or unauthenticated API callers are rejected outright.
  IF _jwt_role = 'anon'
     OR (_caller IS NULL AND _jwt_role <> 'service_role' AND _api)
  THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  _privileged :=
    _jwt_role = 'service_role'
    OR (_caller IS NULL AND NOT _api)  -- trusted direct database session
    OR (_caller IS NOT NULL AND public.has_role(_caller, 'admin'));

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

  -- Allow this function's own writes past the lifecycle guards (transaction-local).
  PERFORM set_config('app.lifecycle_bypass', 'on', true);

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

  PERFORM set_config('app.lifecycle_bypass', 'off', true);

  SELECT account_activated_at INTO _existing
    FROM public.agent_settings WHERE user_id = _user_id;
  RETURN _existing;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_agent_activated(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_agent_activated(uuid) TO authenticated, service_role;

-- Lifecycle UPDATE guard: fail closed for anonymous / unauthenticated API requests.
CREATE OR REPLACE FUNCTION public.guard_agent_settings_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), (current_setting('request.jwt.claims', true)::json ->> 'role'), '');
  api boolean := public.is_api_request();
  lifecycle_changed boolean;
BEGIN
  IF coalesce(current_setting('app.lifecycle_bypass', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  lifecycle_changed :=
       NEW.agent_status IS DISTINCT FROM OLD.agent_status
    OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
    OR NEW.account_activated_at IS DISTINCT FROM OLD.account_activated_at
    OR NEW.verification_method IS DISTINCT FROM OLD.verification_method
    OR NEW.verification_payload IS DISTINCT FROM OLD.verification_payload
    OR NEW.verification_attempt_count IS DISTINCT FROM OLD.verification_attempt_count
    OR NEW.last_verification_attempt_at IS DISTINCT FROM OLD.last_verification_attempt_at
    OR NEW.approval_email_sent IS DISTINCT FROM OLD.approval_email_sent;

  -- Trusted contexts: service_role JWT, admin user, or a direct (non-API) DB session.
  IF jwt_role = 'service_role'
     OR (uid IS NOT NULL AND public.has_role(uid, 'admin'))
     OR (uid IS NULL AND NOT api)
  THEN
    RETURN NEW;
  END IF;

  -- Anonymous / unauthenticated API requests are never trusted.
  IF jwt_role = 'anon' OR uid IS NULL THEN
    IF lifecycle_changed THEN
      RAISE EXCEPTION 'Authentication required'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF lifecycle_changed THEN
    RAISE EXCEPTION 'Agents cannot modify verification/activation lifecycle fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- Lifecycle INSERT guard: same fail-closed behavior.
CREATE OR REPLACE FUNCTION public.guard_agent_settings_lifecycle_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), (current_setting('request.jwt.claims', true)::json ->> 'role'), '');
  api boolean := public.is_api_request();
BEGIN
  IF coalesce(current_setting('app.lifecycle_bypass', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF jwt_role = 'service_role'
     OR (uid IS NOT NULL AND public.has_role(uid, 'admin'))
     OR (uid IS NULL AND NOT api)
  THEN
    RETURN NEW;
  END IF;

  IF jwt_role = 'anon' OR uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  NEW.agent_status := 'pending';
  NEW.verified_at := NULL;
  NEW.account_activated_at := NULL;
  NEW.approval_email_sent := false;
  RETURN NEW;
END;
$function$;