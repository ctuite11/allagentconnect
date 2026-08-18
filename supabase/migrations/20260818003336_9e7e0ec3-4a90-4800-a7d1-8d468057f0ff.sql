-- Developer onboarding: reuse the agent activation-token mechanism for developers.

CREATE OR REPLACE FUNCTION public.developer_is_activation_eligible(_user_id uuid)
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

  -- Never re-activate a previously deleted account.
  IF EXISTS (SELECT 1 FROM public.deleted_users d WHERE lower(d.email) = _email) THEN
    RETURN false;
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

-- Additive: agent eligibility rules are untouched; developers become a second
-- accepted path for the same durable token.
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
    OR public.developer_is_activation_eligible(p_user_id)
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

CREATE OR REPLACE FUNCTION public.claim_agent_activation_token(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.agent_activation_tokens%ROWTYPE;
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

  IF NOT (
    public.agent_is_activation_eligible(_row.user_id)
    OR public.developer_is_activation_eligible(_row.user_id)
  ) THEN
    RETURN jsonb_build_object('status', 'ineligible', 'token_id', _row.id);
  END IF;

  UPDATE public.agent_activation_tokens
     SET status = 'redeeming', redeeming_at = now()
   WHERE id = _row.id;

  RETURN jsonb_build_object('status', 'claimed', 'token_id', _row.id, 'user_id', _row.user_id);
END;
$function$;

-- Idempotent developer provisioning. Callable by an admin (from SQL/UI) or by
-- the service role (from the admin-gated edge function).
CREATE OR REPLACE FUNCTION public.admin_provision_developer_access(
  _request_id uuid,
  _owner_user_id uuid,
  _account_name text DEFAULT NULL,
  _account_slug text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _reviewer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req public.developer_access_requests;
  v_account_id uuid;
  v_name text;
  v_slug text;
  v_base text;
  v_n int := 1;
  v_reviewer uuid;
  v_created boolean := false;
BEGIN
  IF NOT (public.jwt_role_text() = 'service_role' OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'admin role required' USING ERRCODE = '42501';
  END IF;

  IF _owner_user_id IS NULL THEN
    RAISE EXCEPTION 'owner user id is required' USING ERRCODE = '22023';
  END IF;

  v_reviewer := COALESCE(auth.uid(), _reviewer_id);

  SELECT * INTO v_req FROM public.developer_access_requests WHERE id = _request_id FOR UPDATE;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent replay: already provisioned.
  IF v_req.status = 'approved' AND v_req.provisioned_account_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_approved',
      'account_id', v_req.provisioned_account_id,
      'user_id', v_req.provisioned_user_id
    );
  END IF;

  -- Reuse an existing owner membership if this user already has one.
  SELECT m.account_id INTO v_account_id
  FROM public.development_account_members m
  JOIN public.development_accounts a ON a.id = m.account_id
  WHERE m.user_id = _owner_user_id AND m.role = 'owner'
  ORDER BY m.created_at
  LIMIT 1;

  IF v_account_id IS NULL THEN
    v_name := COALESCE(NULLIF(btrim(_account_name), ''), v_req.company_name);
    v_base := btrim(
      regexp_replace(lower(COALESCE(NULLIF(btrim(_account_slug), ''), v_name)), '[^a-z0-9]+', '-', 'g'),
      '-'
    );
    IF v_base = '' THEN
      v_base := 'developer';
    END IF;
    v_slug := v_base;
    WHILE EXISTS (SELECT 1 FROM public.development_accounts WHERE slug = v_slug) LOOP
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n::text;
    END LOOP;

    INSERT INTO public.development_accounts (name, slug, billing_email)
    VALUES (v_name, v_slug, v_req.email)
    RETURNING id INTO v_account_id;

    INSERT INTO public.development_account_members (account_id, user_id, role, invited_by, accepted_at)
    VALUES (v_account_id, _owner_user_id, 'owner', v_reviewer, now());

    v_created := true;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_owner_user_id, 'developer'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.developer_access_requests
     SET status = 'approved',
         reviewed_by = COALESCE(v_reviewer, reviewed_by),
         reviewed_at = now(),
         review_notes = COALESCE(_notes, review_notes),
         provisioned_user_id = _owner_user_id,
         provisioned_account_id = v_account_id
   WHERE id = _request_id;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_created THEN 'approved' ELSE 'approved_existing_account' END,
    'account_id', v_account_id,
    'user_id', _owner_user_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_provision_developer_access(uuid, uuid, text, text, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_provision_developer_access(uuid, uuid, text, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.developer_is_activation_eligible(uuid) TO authenticated, service_role;