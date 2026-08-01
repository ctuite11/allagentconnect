-- =====================================================================
-- AAC-owned License Verified activation tokens (7-day lifetime)
-- Branch implementation — NOT applied to production.
--
-- Design invariants
--  * No plaintext activation token is ever persisted or queued. Only a
--    SHA-256 digest is stored; the token itself is a reproducible HMAC
--    computed by the edge runtime from (id, user_id, expires_at_epoch).
--  * Issuance is idempotent on a server-derived `issuance_key`.
--  * Token row + email job row are created in ONE transaction.
--  * Resend consumes its single-use handle in the SAME transaction that
--    creates the replacement token and the queue job. Any failure rolls
--    the whole thing back and the handle remains unused.
--  * Security-definer functions never insert caller-supplied JSON; the
--    email payload is constructed here from validated scalars.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_activation_tokens (
  id            uuid PRIMARY KEY,                -- caller-supplied, signed into the token
  user_id       uuid NOT NULL,
  token_hash    text NOT NULL UNIQUE,            -- sha256 hex of the plaintext token
  issuance_key  text NOT NULL UNIQUE,            -- server-derived dedupe key
  status        text NOT NULL DEFAULT 'issued'
                CHECK (status IN ('issued','redeeming','redeemed','revoked')),
  expires_at    timestamptz NOT NULL,
  redeeming_at  timestamptz,
  redeemed_at   timestamptz,
  revoked_at    timestamptz,
  email_job_id  uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- At most one live token per agent (final constraint; logic enforces it first).
CREATE UNIQUE INDEX IF NOT EXISTS agent_activation_tokens_one_live
  ON public.agent_activation_tokens (user_id)
  WHERE status IN ('issued','redeeming');

CREATE INDEX IF NOT EXISTS agent_activation_tokens_user_idx
  ON public.agent_activation_tokens (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_activation_resend_handles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id    uuid NOT NULL REFERENCES public.agent_activation_tokens(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  handle_hash text NOT NULL UNIQUE,              -- sha256 hex of the opaque handle
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_activation_resend_handles_token_idx
  ON public.agent_activation_resend_handles (token_id);

-- Service-role only. No anon/authenticated access at all.
REVOKE ALL ON public.agent_activation_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.agent_activation_resend_handles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.agent_activation_tokens TO service_role;
GRANT ALL ON public.agent_activation_resend_handles TO service_role;

ALTER TABLE public.agent_activation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activation_resend_handles ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only service_role (which bypasses RLS) may read.

DROP TRIGGER IF EXISTS agent_activation_tokens_touch ON public.agent_activation_tokens;
CREATE TRIGGER agent_activation_tokens_touch
  BEFORE UPDATE ON public.agent_activation_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 2. Guard helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_service_role()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF public.jwt_role_text() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_service_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_service_role() TO service_role;

-- Eligibility: verified agent, not yet activated, live auth user, not banned,
-- not archived in deleted_users, latest verification record not rejected.
CREATE OR REPLACE FUNCTION public.agent_is_activation_eligible(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email text;
  _ok boolean;
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

  IF EXISTS (SELECT 1 FROM public.deleted_users d WHERE lower(d.email) = _email) THEN
    RETURN false;
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
$$;

REVOKE ALL ON FUNCTION public.agent_is_activation_eligible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_is_activation_eligible(uuid) TO service_role;

-- Payload builder — the ONLY source of the queued job payload. Caller-supplied
-- JSON is never accepted anywhere in this module.
CREATE OR REPLACE FUNCTION public.build_activation_email_payload(
  p_token_id  uuid,
  p_to_email  text,
  p_subject   text,
  p_reply_to  text,
  p_agent_name text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  _subject text;
  _reply   text;
  _name    text;
BEGIN
  _subject := left(btrim(coalesce(regexp_replace(p_subject, '[[:cntrl:]]', '', 'g'), '')), 200);
  IF _subject = '' THEN
    _subject := 'Your license has been verified — welcome to All Agent Connect';
  END IF;

  _reply := lower(btrim(coalesce(p_reply_to, '')));
  IF _reply !~ '^[a-z0-9._%+-]+@([a-z0-9-]+\.)*allagentconnect\.com$' THEN
    _reply := 'chris@allagentconnect.com';
  END IF;

  _name := left(btrim(coalesce(regexp_replace(p_agent_name, '[[:cntrl:]]', '', 'g'), '')), 80);

  RETURN jsonb_build_object(
    'provider', 'resend',
    'template', 'license-verified',
    'to', p_to_email,
    'subject', _subject,
    'reply_to', _reply,
    'agent_name', nullif(_name, ''),
    'activation_token_id', p_token_id::text,
    'idempotency_key', 'license-verified/' || p_token_id::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.build_activation_email_payload(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_activation_email_payload(uuid, text, text, text, text) TO service_role;

-- ---------------------------------------------------------------------
-- 3. Internal issuance core (token row + email job, one transaction)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activation_issue_core(
  p_id           uuid,
  p_user_id      uuid,
  p_token_hash   text,
  p_expires_at   timestamptz,
  p_issuance_key text,
  p_allow_replace boolean,
  p_subject      text,
  p_reply_to     text,
  p_agent_name   text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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

  IF NOT public.agent_is_activation_eligible(p_user_id) THEN
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
$$;

REVOKE ALL ON FUNCTION public.activation_issue_core(uuid, uuid, text, timestamptz, text, boolean, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Public (service-role) issuance RPC — initial License Verified send
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_agent_activation_token(
  p_id         uuid,
  p_user_id    uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_subject    text DEFAULT NULL,
  p_reply_to   text DEFAULT NULL,
  p_agent_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    p_id, p_user_id, p_token_hash, p_expires_at, _key, false, p_subject, p_reply_to, p_agent_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_agent_activation_token(uuid, uuid, text, timestamptz, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_agent_activation_token(uuid, uuid, text, timestamptz, text, text, text) TO service_role;

-- ---------------------------------------------------------------------
-- 5. Redemption state machine
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_agent_activation_token(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  IF NOT public.agent_is_activation_eligible(_row.user_id) THEN
    RETURN jsonb_build_object('status', 'ineligible', 'token_id', _row.id);
  END IF;

  UPDATE public.agent_activation_tokens
     SET status = 'redeeming', redeeming_at = now()
   WHERE id = _row.id;

  RETURN jsonb_build_object('status', 'claimed', 'token_id', _row.id, 'user_id', _row.user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_agent_activation_token(p_token_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _n int;
BEGIN
  PERFORM public.assert_service_role();
  UPDATE public.agent_activation_tokens
     SET status = 'redeemed', redeemed_at = now()
   WHERE id = p_token_id AND status = 'redeeming';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_agent_activation_token(p_token_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _n int;
BEGIN
  PERFORM public.assert_service_role();
  UPDATE public.agent_activation_tokens
     SET status = 'issued', redeeming_at = NULL
   WHERE id = p_token_id AND status = 'redeeming';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_agent_activation_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_agent_activation_token(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_agent_activation_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_agent_activation_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_agent_activation_token(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_agent_activation_token(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- 6. Resend handles
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_activation_resend_handle(
  p_token_id    uuid,
  p_handle_hash text,
  p_expires_at  timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _user uuid;
BEGIN
  PERFORM public.assert_service_role();

  IF p_handle_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'handle_hash must be sha256 hex' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NULL OR p_expires_at <= now() OR p_expires_at > now() + interval '30 minutes' THEN
    RAISE EXCEPTION 'handle expiry out of range' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO _user FROM public.agent_activation_tokens WHERE id = p_token_id;
  IF _user IS NULL THEN
    RETURN false;
  END IF;

  -- Cap outstanding handles per token.
  IF (SELECT count(*) FROM public.agent_activation_resend_handles
       WHERE token_id = p_token_id AND used_at IS NULL AND expires_at > now()) >= 3 THEN
    RETURN false;
  END IF;

  INSERT INTO public.agent_activation_resend_handles (token_id, user_id, handle_hash, expires_at)
  VALUES (p_token_id, _user, lower(p_handle_hash), p_expires_at);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_activation_resend_handle(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_activation_resend_handle(uuid, text, timestamptz) TO service_role;

-- ATOMIC RESEND.
-- Validates+locks the handle, creates the replacement token, inserts the
-- transactional job, then marks the handle used — all in one transaction.
-- Any failure rolls everything back and the handle remains UNUSED.
CREATE OR REPLACE FUNCTION public.redeem_resend_handle_and_issue(
  p_handle_hash   text,
  p_new_token_id  uuid,
  p_new_token_hash text,
  p_expires_at    timestamptz,
  p_subject       text DEFAULT NULL,
  p_reply_to      text DEFAULT NULL,
  p_agent_name    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _handle public.agent_activation_resend_handles%ROWTYPE;
  _result jsonb;
BEGIN
  PERFORM public.assert_service_role();

  -- (1) Lock the handle. Not consumed yet.
  SELECT * INTO _handle
  FROM public.agent_activation_resend_handles
  WHERE handle_hash = lower(p_handle_hash)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_handle');
  END IF;
  IF _handle.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'handle_used');
  END IF;
  IF _handle.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'handle_expired');
  END IF;

  -- (2)-(4) advisory lock + replacement token + queue job, atomically.
  _result := public.activation_issue_core(
    p_new_token_id,
    _handle.user_id,
    p_new_token_hash,
    p_expires_at,
    'resend:' || _handle.user_id::text || ':' || _handle.id::text,
    true,
    p_subject,
    p_reply_to,
    p_agent_name
  );

  IF _result->>'status' NOT IN ('created', 'deduped') THEN
    -- No token, no job, handle untouched.
    RETURN _result;
  END IF;

  -- (5) Only now is the single-use handle consumed.
  UPDATE public.agent_activation_resend_handles
     SET used_at = now()
   WHERE id = _handle.id AND used_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resend handle consumed concurrently' USING ERRCODE = '40001';
  END IF;

  -- (6) Commit happens at statement end: token + job + handle together.
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_resend_handle_and_issue(text, uuid, text, timestamptz, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_resend_handle_and_issue(text, uuid, text, timestamptz, text, text, text) TO service_role;
