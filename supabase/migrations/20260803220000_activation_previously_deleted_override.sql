-- Activation issuance: stop a stale deletion tombstone from permanently
-- blocking an agent who was deleted and later legitimately re-verified.
--
-- Two changes:
--  1. `agent_is_activation_eligible` now ignores a `deleted_users` row that
--     predates the CURRENT auth user. Such a row describes a previous account
--     for that address, not this one. A tombstone recorded at or after the
--     current account's creation still blocks (that is a real deletion of the
--     live account).
--  2. An explicit `_allow_previously_deleted` override is threaded from the
--     admin-acknowledged edge-function path through issuance, so an admin who
--     acknowledges "previously deleted" can actually send the setup link.
--     Every other gate (deleted/banned auth user, rejected verification, wrong
--     status, already activated) stays enforced.

CREATE OR REPLACE FUNCTION public.agent_is_activation_eligible(
  _user_id uuid,
  _allow_previously_deleted boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email      text;
  _created_at timestamptz;
  _ok         boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(u.email), u.created_at
    INTO _email, _created_at
  FROM auth.users u
  WHERE u.id = _user_id
    AND u.deleted_at IS NULL
    AND (u.banned_until IS NULL OR u.banned_until <= now());

  IF _email IS NULL THEN
    RETURN false;
  END IF;

  -- Only a tombstone belonging to THIS account blocks. Older tombstones refer
  -- to a prior account for the same address that has since been replaced.
  IF NOT coalesce(_allow_previously_deleted, false) THEN
    IF EXISTS (
      SELECT 1
      FROM public.deleted_users d
      WHERE lower(d.email) = _email
        AND (
          d.original_user_id = _user_id
          OR d.deleted_at >= coalesce(_created_at, d.deleted_at)
        )
    ) THEN
      RETURN false;
    END IF;
  END IF;

  SELECT (pv.status IS DISTINCT FROM 'rejected' AND pv.rejected_at IS NULL)
    INTO _ok
    FROM public.pending_verifications pv
   WHERE pv.user_id = _user_id
   ORDER BY pv.created_at DESC
   LIMIT 1;

  IF _ok IS NOT NULL AND _ok IS NOT TRUE THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.agent_settings s
    JOIN public.user_roles r ON r.user_id = s.user_id AND r.role = 'agent'
    WHERE s.user_id = _user_id
      AND s.agent_status IN ('verified','invited')
      AND s.account_activated_at IS NULL
  );
END;
$function$;

-- Existing single-argument callers (token redemption) keep working unchanged.
CREATE OR REPLACE FUNCTION public.agent_is_activation_eligible(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.agent_is_activation_eligible(_user_id, false);
$function$;

REVOKE ALL ON FUNCTION public.agent_is_activation_eligible(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_is_activation_eligible(uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.activation_issue_core(
  p_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamp with time zone,
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

  -- Serialize every issuance path for this user.
  PERFORM pg_advisory_xact_lock(hashtextextended('aac_activation:' || p_user_id::text, 0));

  -- (a) Idempotent replay.
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

  IF NOT public.agent_is_activation_eligible(p_user_id, coalesce(p_allow_previously_deleted, false)) THEN
    -- Distinguish the acknowledge-able case so the admin UI can explain it.
    IF NOT coalesce(p_allow_previously_deleted, false)
       AND public.agent_is_activation_eligible(p_user_id, true) THEN
      RETURN jsonb_build_object('status', 'previously_deleted');
    END IF;
    RETURN jsonb_build_object('status', 'ineligible');
  END IF;

  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = p_user_id;
  IF _email IS NULL OR _email NOT LIKE '%@%' THEN
    RETURN jsonb_build_object('status', 'no_recipient');
  END IF;

  -- (b) Reclaim only this user's stale reservation.
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

  -- (c) Replacement issuance revokes prior live tokens; initial issuance never does.
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

  -- (d) Token row.
  INSERT INTO public.agent_activation_tokens
    (id, user_id, token_hash, issuance_key, status, expires_at)
  VALUES
    (p_id, p_user_id, lower(p_token_hash), p_issuance_key, 'issued', date_trunc('second', p_expires_at));

  -- (e) Email job — payload built here, never accepted from the caller.
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

CREATE OR REPLACE FUNCTION public.issue_agent_activation_token(
  p_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamp with time zone,
  p_subject text DEFAULT NULL::text,
  p_reply_to text DEFAULT NULL::text,
  p_agent_name text DEFAULT NULL::text,
  p_allow_previously_deleted boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _verified_at timestamptz;
  _key text;
BEGIN
  PERFORM public.assert_service_role();

  -- Issuance key is derived from the immutable approval event. Callers cannot
  -- influence it, so double-clicks and retries collapse onto one token+job.
  SELECT verified_at INTO _verified_at FROM public.agent_settings WHERE user_id = p_user_id;
  _key := 'license-verified:' || p_user_id::text || ':' ||
          coalesce(extract(epoch FROM date_trunc('second', _verified_at))::bigint::text, 'unverified');

  RETURN public.activation_issue_core(
    p_id, p_user_id, p_token_hash, p_expires_at, _key, false, p_subject, p_reply_to, p_agent_name,
    coalesce(p_allow_previously_deleted, false)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reissue_agent_activation_token(
  p_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamp with time zone,
  p_subject text DEFAULT NULL::text,
  p_reply_to text DEFAULT NULL::text,
  p_agent_name text DEFAULT NULL::text,
  p_allow_previously_deleted boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_service_role();

  RETURN public.activation_issue_core(
    p_id,
    p_user_id,
    p_token_hash,
    p_expires_at,
    'admin-resend:' || p_user_id::text || ':' || to_char(now() AT TIME ZONE 'utc', 'YYYYMMDDHH24MI'),
    true,
    p_subject,
    p_reply_to,
    p_agent_name,
    coalesce(p_allow_previously_deleted, false)
  );
END;
$function$;
