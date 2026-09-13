-- Silent (no-email) issuance variants used ONLY by Admin -> "Copy setup link".
-- These are new, separately named functions. The existing emailing RPCs
-- (issue_agent_activation_token / reissue_agent_activation_token /
-- issue_agent_login_token) are left completely untouched, so the
-- License Verified / Email setup link / send-login-link flows are unchanged.
--
-- Behaviour mirrors the emailing paths exactly, minus the email_jobs insert:
--   * service-role only
--   * 30/31-day expiry guard
--   * per-user advisory lock
--   * same eligibility gates
--   * only sha256(token) is stored; the plaintext token never reaches the DB

CREATE OR REPLACE FUNCTION public.issue_agent_activation_token_no_email(
  p_id                       uuid,
  p_user_id                  uuid,
  p_token_hash               text,
  p_expires_at               timestamptz,
  p_allow_previously_deleted boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email   text;
  _live_ct int;
  _ack     boolean := coalesce(p_allow_previously_deleted, false);
  _key     text;
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

  -- Distinct namespace so a copied link can never dedupe onto, or be mistaken
  -- for, an emailed License Verified issuance. Minute-bucketed so a
  -- double-click collapses onto a single token.
  _key := 'admin-copy-link:' || p_user_id::text || ':' ||
          to_char(date_trunc('minute', now() AT TIME ZONE 'utc'), 'YYYYMMDDHH24MI');

  PERFORM pg_advisory_xact_lock(hashtextextended('aac_activation:' || p_user_id::text, 0));

  IF EXISTS (SELECT 1 FROM public.agent_activation_tokens WHERE issuance_key = _key) THEN
    RETURN jsonb_build_object('status', 'deduped');
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

  -- A freshly copied link always supersedes any prior live link, matching the
  -- admin resend semantics.
  UPDATE public.agent_activation_tokens
     SET status = 'revoked', revoked_at = now()
   WHERE user_id = p_user_id AND status = 'issued';

  INSERT INTO public.agent_activation_tokens
    (id, user_id, token_hash, issuance_key, status, expires_at, allow_previously_deleted)
  VALUES
    (p_id, p_user_id, lower(p_token_hash), _key, 'issued',
     date_trunc('second', p_expires_at), _ack);

  -- Deliberately NO email_jobs insert: this link is copied by an admin.

  RETURN jsonb_build_object(
    'status', 'created',
    'token_id', p_id,
    'expires_at', date_trunc('second', p_expires_at)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_agent_activation_token_no_email(uuid, uuid, text, timestamptz, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_agent_activation_token_no_email(uuid, uuid, text, timestamptz, boolean)
  TO service_role;


CREATE OR REPLACE FUNCTION public.issue_agent_login_token_no_email(
  p_id         uuid,
  p_user_id    uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email   text;
  _live_ct int;
  _key     text;
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

  _key := 'agent-login-link:' || p_user_id::text || ':admin-copy-link:' ||
          to_char(date_trunc('minute', now() AT TIME ZONE 'utc'), 'YYYYMMDDHH24MI');

  PERFORM pg_advisory_xact_lock(hashtextextended('aac_login_link:' || p_user_id::text, 0));

  IF EXISTS (SELECT 1 FROM public.agent_login_tokens WHERE issuance_key = _key) THEN
    RETURN jsonb_build_object('status', 'deduped');
  END IF;

  IF NOT public.agent_is_login_eligible(p_user_id) THEN
    RETURN jsonb_build_object('status', 'ineligible');
  END IF;

  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = p_user_id;
  IF _email IS NULL OR _email NOT LIKE '%@%' THEN
    RETURN jsonb_build_object('status', 'no_recipient');
  END IF;

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

  UPDATE public.agent_login_tokens
     SET status = 'revoked', revoked_at = now()
   WHERE user_id = p_user_id AND status = 'issued';

  INSERT INTO public.agent_login_tokens
    (id, user_id, token_hash, issuance_key, status, expires_at)
  VALUES
    (p_id, p_user_id, lower(p_token_hash), _key, 'issued',
     date_trunc('second', p_expires_at));

  -- Deliberately NO email_jobs insert: this link is copied by an admin.

  RETURN jsonb_build_object(
    'status', 'created',
    'token_id', p_id,
    'expires_at', date_trunc('second', p_expires_at)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_agent_login_token_no_email(uuid, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_agent_login_token_no_email(uuid, uuid, text, timestamptz)
  TO service_role;