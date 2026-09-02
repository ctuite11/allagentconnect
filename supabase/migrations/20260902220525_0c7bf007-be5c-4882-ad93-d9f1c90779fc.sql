CREATE OR REPLACE FUNCTION public.activation_issue_core(p_id uuid, p_user_id uuid, p_token_hash text, p_expires_at timestamp with time zone, p_issuance_key text, p_allow_replace boolean, p_subject text, p_reply_to text, p_agent_name text, p_allow_previously_deleted boolean DEFAULT false)
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
  _ack       boolean := coalesce(p_allow_previously_deleted, false);
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

  IF p_expires_at <= now() OR p_expires_at > now() + interval '31 days' THEN
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
    public.agent_is_activation_eligible(p_user_id, _ack)
    OR public.developer_is_activation_eligible(p_user_id, _ack)
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
    (id, user_id, token_hash, issuance_key, status, expires_at, allow_previously_deleted)
  VALUES
    (p_id, p_user_id, lower(p_token_hash), p_issuance_key, 'issued', date_trunc('second', p_expires_at), _ack);

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

CREATE OR REPLACE FUNCTION public.issue_agent_login_token(p_id uuid, p_user_id uuid, p_token_hash text, p_expires_at timestamp with time zone, p_issuance_key text, p_subject text DEFAULT NULL::text, p_reply_to text DEFAULT NULL::text, p_agent_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _existing public.agent_login_tokens%ROWTYPE;
  _email    text;
  _job_id   uuid;
  _payload  jsonb;
  _live_ct  int;
  _key      text;
BEGIN
  PERFORM public.assert_service_role();

  IF p_id IS NULL OR p_user_id IS NULL
     OR coalesce(btrim(p_token_hash), '') = ''
     OR p_expires_at IS NULL THEN
    RAISE EXCEPTION 'invalid issuance arguments' USING ERRCODE = '22023';
  END IF;

  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'token_hash must be sha256 hex' USING ERRCODE = '22023';
  END IF;

  IF p_expires_at <= now() OR p_expires_at > now() + interval '31 days' THEN
    RAISE EXCEPTION 'expires_at out of range' USING ERRCODE = '22023';
  END IF;

  -- Minute-bucketed so an admin double-click collapses onto one token+job.
  _key := 'agent-login-link:' || p_user_id::text || ':' ||
          coalesce(left(btrim(regexp_replace(p_issuance_key, '[[:cntrl:]]', '', 'g')), 64),
                   to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI'));

  PERFORM pg_advisory_xact_lock(hashtextextended('aac_login_link:' || p_user_id::text, 0));

  SELECT * INTO _existing FROM public.agent_login_tokens WHERE issuance_key = _key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'deduped',
      'token_id', _existing.id,
      'job_id', _existing.email_job_id,
      'expires_at', _existing.expires_at
    );
  END IF;

  IF NOT public.agent_is_login_eligible(p_user_id) THEN
    RETURN jsonb_build_object('status', 'ineligible');
  END IF;

  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = p_user_id;
  IF _email IS NULL OR _email NOT LIKE '%@%' THEN
    RETURN jsonb_build_object('status', 'no_recipient');
  END IF;

  -- Reclaim this user's stale reservation only.
  UPDATE public.agent_login_tokens
     SET status = 'issued', redeeming_at = NULL
   WHERE user_id = p_user_id
     AND status = 'redeeming'
     AND redeeming_at < now() - interval '5 minutes';

  SELECT count(*) INTO _live_ct
  FROM public.agent_login_tokens
  WHERE user_id = p_user_id AND status = 'redeeming';

  IF _live_ct > 0 THEN
    RETURN jsonb_build_object('status', 'blocked');
  END IF;

  -- A new login link always supersedes the previous one.
  UPDATE public.agent_login_tokens
     SET status = 'revoked', revoked_at = now()
   WHERE user_id = p_user_id AND status = 'issued';

  INSERT INTO public.agent_login_tokens
    (id, user_id, token_hash, issuance_key, status, expires_at)
  VALUES
    (p_id, p_user_id, lower(p_token_hash), _key, 'issued', date_trunc('second', p_expires_at));

  _payload := public.build_login_link_email_payload(p_id, _email, p_subject, p_reply_to, p_agent_name);

  INSERT INTO public.email_jobs (payload, idempotency_key, max_attempts, stream)
  VALUES (_payload, 'agent-login-link/' || p_id::text, 6, 'transactional')
  RETURNING id INTO _job_id;

  UPDATE public.agent_login_tokens SET email_job_id = _job_id WHERE id = p_id;

  RETURN jsonb_build_object(
    'status', 'created',
    'token_id', p_id,
    'job_id', _job_id,
    'expires_at', date_trunc('second', p_expires_at)
  );
END;
$function$;