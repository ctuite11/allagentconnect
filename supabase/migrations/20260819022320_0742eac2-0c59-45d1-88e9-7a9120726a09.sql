ALTER TABLE public.agent_activation_tokens
  ADD COLUMN IF NOT EXISTS allow_previously_deleted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.agent_activation_tokens.allow_previously_deleted IS
  'True only when an admin explicitly acknowledged an existing deleted_users tombstone at issuance. Redemption may bypass ONLY the previously-deleted check for this exact token.';

-- Developer eligibility gains an explicit acknowledgement parameter.
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
  -- acknowledged the tombstone for this specific issuance.
  IF NOT coalesce(_allow_previously_deleted, false)
     AND EXISTS (SELECT 1 FROM public.deleted_users d WHERE lower(d.email) = _email) THEN
    RETURN false;
  END IF;

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

REVOKE ALL ON FUNCTION public.developer_is_activation_eligible(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.developer_is_activation_eligible(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.developer_is_activation_eligible(uuid) TO authenticated, service_role;

-- Persist the acknowledgement on the issued token row.
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

-- Redemption honours the acknowledgement stored on that exact token row.
CREATE OR REPLACE FUNCTION public.claim_agent_activation_token(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.agent_activation_tokens%ROWTYPE;
  _ack boolean;
BEGIN
  PERFORM public.assert_service_role();

  SELECT * INTO _row
  FROM public.agent_activation_tokens
  WHERE token_hash = lower(p_token_hash)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF _row.status = 'redeemed' THEN
    RETURN jsonb_build_object('status', 'used', 'token_id', _row.id);
  END IF;

  IF _row.status = 'revoked' THEN
    RETURN jsonb_build_object('status', 'revoked', 'token_id', _row.id);
  END IF;

  IF _row.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired', 'token_id', _row.id);
  END IF;

  IF _row.status = 'redeeming' AND _row.redeeming_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('status', 'in_progress', 'token_id', _row.id);
  END IF;

  _ack := coalesce(_row.allow_previously_deleted, false);

  IF NOT (
    public.agent_is_activation_eligible(_row.user_id, _ack)
    OR public.developer_is_activation_eligible(_row.user_id, _ack)
  ) THEN
    RETURN jsonb_build_object('status', 'ineligible', 'token_id', _row.id);
  END IF;

  UPDATE public.agent_activation_tokens
     SET status = 'redeeming', redeeming_at = now()
   WHERE id = _row.id;

  RETURN jsonb_build_object('status', 'claimed', 'token_id', _row.id, 'user_id', _row.user_id);
END;
$function$;

-- One-time repair: the developer setup link already issued through the
-- explicitly acknowledged recovery path, so the link already in the mailbox
-- keeps working without resending anything.
UPDATE public.agent_activation_tokens
   SET allow_previously_deleted = true
 WHERE id = '296b3b3b-35e5-4d19-aaf3-74d79b7213d1'
   AND status = 'issued';