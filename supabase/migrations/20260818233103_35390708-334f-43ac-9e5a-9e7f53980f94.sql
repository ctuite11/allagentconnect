-- 1. Developer eligibility gains an explicit "acknowledged previous deletion" override.
CREATE OR REPLACE FUNCTION public.developer_is_activation_eligible(
  _user_id uuid,
  _allow_previously_deleted boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(u.email) INTO _email
  FROM auth.users u
  WHERE u.id = _user_id
    AND u.deleted_at IS NULL
    AND (u.banned_until IS NULL OR u.banned_until <= now());

  IF _email IS NULL THEN
    RETURN false;
  END IF;

  -- Never re-activate a previously deleted account unless an admin explicitly
  -- acknowledged the tombstone (same rule agents use).
  IF NOT coalesce(_allow_previously_deleted, false) THEN
    IF EXISTS (SELECT 1 FROM public.deleted_users d WHERE lower(d.email) = _email) THEN
      RETURN false;
    END IF;
  END IF;

  -- Developer role + an owner/admin membership on an active development account.
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles r
    JOIN public.development_account_members m ON m.user_id = r.user_id
    JOIN public.development_accounts a ON a.id = m.account_id AND a.is_active
    WHERE r.user_id = _user_id
      AND r.role = 'developer'::public.app_role
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.developer_is_activation_eligible(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.developer_is_activation_eligible(_user_id, false);
$function$;

-- 2. The 10-arg issuance core passes the acknowledgement through to developers.
CREATE OR REPLACE FUNCTION public.activation_issue_core(
  p_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_issuance_key text,
  p_allow_replace boolean,
  p_subject text,
  p_reply_to text,
  p_agent_name text,
  p_allow_previously_deleted boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _existing  public.agent_activation_tokens%ROWTYPE;
  _email     text;
  _job_id    uuid;
  _payload   jsonb;
  _live_ct   int;
BEGIN
  IF p_id IS NULL OR p_user_id IS NULL
     OR coalesce(btrim(p_token_hash), '') = ''
     OR coalesce(btrim(p_issuance_key), '') = ''
     OR p_expires_at IS NULL THEN
    RAISE EXCEPTION 'invalid issuance arguments' USING ERRCODE = '22023';
  END IF;

  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'token_hash must be sha256 hex' USING ERRCODE = '22023';
  END IF;

  IF p_expires_at <= now() OR p_expires_at > now() + interval '8 days' THEN
    RAISE EXCEPTION 'expires_at out of range' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('aac_activation:' || p_user_id::text, 0));

  SELECT * INTO _existing
  FROM public.agent_activation_tokens
  WHERE issuance_key = p_issuance_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'deduped',
      'token_id', _existing.id,
      'job_id', _existing.email_job_id,
      'expires_at', _existing.expires_at
    );
  END IF;

  IF NOT (
    public.agent_is_activation_eligible(p_user_id, coalesce(p_allow_previously_deleted, false))
    OR public.developer_is_activation_eligible(p_user_id, coalesce(p_allow_previously_deleted, false))
  ) THEN
    RETURN jsonb_build_object('status', 'ineligible');
  END IF;

  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = p_user_id;
  IF _email IS NULL OR _email NOT LIKE '%@%' THEN
    RETURN jsonb_build_object('status', 'no_recipient');
  END IF;

  UPDATE public.agent_activation_tokens
     SET status = 'issued', redeeming_at = NULL
   WHERE user_id = p_user_id
     AND status = 'redeeming'
     AND redeeming_at < now() - interval '5 minutes';

  SELECT count(*) INTO _live_ct
  FROM public.agent_activation_tokens
  WHERE user_id = p_user_id AND status = 'redeeming';

  IF _live_ct > 0 THEN
    RETURN jsonb_build_object('status', 'blocked');
  END IF;

  IF p_allow_replace THEN
    UPDATE public.agent_activation_tokens
       SET status = 'revoked', revoked_at = now()
     WHERE user_id = p_user_id AND status = 'issued';
  ELSIF EXISTS (
    SELECT 1 FROM public.agent_activation_tokens
    WHERE user_id = p_user_id AND status = 'issued'
  ) THEN
    RETURN jsonb_build_object('status', 'already_live');
  END IF;

  INSERT INTO public.agent_activation_tokens
    (id, user_id, token_hash, issuance_key, status, expires_at)
  VALUES
    (p_id, p_user_id, lower(p_token_hash), p_issuance_key, 'issued', date_trunc('second', p_expires_at));

  _payload := public.build_activation_email_payload(p_id, _email, p_subject, p_reply_to, p_agent_name);

  INSERT INTO public.email_jobs (payload, idempotency_key, max_attempts, stream)
  VALUES (_payload, 'license-verified/' || p_id::text, 6, 'transactional')
  RETURNING id INTO _job_id;

  UPDATE public.agent_activation_tokens SET email_job_id = _job_id WHERE id = p_id;

  RETURN jsonb_build_object(
    'status', 'created',
    'token_id', p_id,
    'job_id', _job_id,
    'expires_at', date_trunc('second', p_expires_at)
  );
END;
$function$;

-- 3. The legacy 9-arg overload had drifted (agent-only gate). It now delegates
--    to the canonical implementation so there is exactly one set of rules.
CREATE OR REPLACE FUNCTION public.activation_issue_core(
  p_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_issuance_key text,
  p_allow_replace boolean,
  p_subject text,
  p_reply_to text,
  p_agent_name text
)
RETURNS jsonb
LANGUAGE sql
SET search_path TO 'public'
AS $function$
  SELECT public.activation_issue_core(
    p_id, p_user_id, p_token_hash, p_expires_at, p_issuance_key,
    p_allow_replace, p_subject, p_reply_to, p_agent_name, false
  );
$function$;