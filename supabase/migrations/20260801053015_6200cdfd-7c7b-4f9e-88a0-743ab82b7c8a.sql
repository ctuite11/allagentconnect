-- =====================================================================
-- AAC-owned login links (7-day lifetime)
--
-- Mirrors the activation-token design. The AAC token is what lives for
-- 7 days; the short-lived Supabase auth link is minted at click time by
-- redeem-login-token. Global auth OTP expiry is NOT changed.
--
-- Invariants:
--  * Plaintext token is never persisted and never queued — only sha256.
--  * Token row + email job are created in ONE transaction.
--  * Single-use, atomic issued -> redeeming -> redeemed transition.
--  * Service-role only; no anon/authenticated access.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.agent_login_tokens (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL,
  token_hash    text NOT NULL UNIQUE,
  issuance_key  text NOT NULL UNIQUE,
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

CREATE UNIQUE INDEX IF NOT EXISTS agent_login_tokens_one_live
  ON public.agent_login_tokens (user_id)
  WHERE status IN ('issued','redeeming');

CREATE INDEX IF NOT EXISTS agent_login_tokens_user_idx
  ON public.agent_login_tokens (user_id, created_at DESC);

REVOKE ALL ON public.agent_login_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.agent_login_tokens TO service_role;
ALTER TABLE public.agent_login_tokens ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only service_role (bypasses RLS) may read.

DROP TRIGGER IF EXISTS agent_login_tokens_touch ON public.agent_login_tokens;
CREATE TRIGGER agent_login_tokens_touch
  BEFORE UPDATE ON public.agent_login_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- Eligibility: a live, non-banned, non-archived auth user.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agent_is_login_eligible(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  IF EXISTS (SELECT 1 FROM public.deleted_users d WHERE lower(d.email) = _email) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_is_login_eligible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_is_login_eligible(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- Payload builder — the ONLY source of the queued job payload.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_login_link_email_payload(
  p_token_id   uuid,
  p_to_email   text,
  p_subject    text,
  p_reply_to   text,
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
    _subject := 'Your All Agent Connect sign-in link';
  END IF;

  _reply := lower(btrim(coalesce(p_reply_to, '')));
  IF _reply !~ '^[a-z0-9._%+-]+@([a-z0-9-]+\.)*allagentconnect\.com$' THEN
    _reply := 'chris@allagentconnect.com';
  END IF;

  _name := left(btrim(coalesce(regexp_replace(p_agent_name, '[[:cntrl:]]', '', 'g'), '')), 80);

  RETURN jsonb_build_object(
    'provider', 'resend',
    'template', 'agent-login-link',
    'to', p_to_email,
    'subject', _subject,
    'reply_to', _reply,
    'agent_name', nullif(_name, ''),
    'login_token_id', p_token_id::text,
    'idempotency_key', 'agent-login-link/' || p_token_id::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.build_login_link_email_payload(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_login_link_email_payload(uuid, text, text, text, text) TO service_role;

-- ---------------------------------------------------------------------
-- Issuance: token row + transactional email job, one transaction.
-- Re-issuing revokes any prior live token for that agent.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_agent_login_token(
  p_id           uuid,
  p_user_id      uuid,
  p_token_hash   text,
  p_expires_at   timestamptz,
  p_issuance_key text,
  p_subject      text DEFAULT NULL,
  p_reply_to     text DEFAULT NULL,
  p_agent_name   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  IF p_expires_at <= now() OR p_expires_at > now() + interval '8 days' THEN
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
$$;

REVOKE ALL ON FUNCTION public.issue_agent_login_token(uuid, uuid, text, timestamptz, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_agent_login_token(uuid, uuid, text, timestamptz, text, text, text, text) TO service_role;

-- ---------------------------------------------------------------------
-- Redemption state machine
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_agent_login_token(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _row public.agent_login_tokens%ROWTYPE;
BEGIN
  PERFORM public.assert_service_role();

  SELECT * INTO _row
  FROM public.agent_login_tokens
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

  IF NOT public.agent_is_login_eligible(_row.user_id) THEN
    RETURN jsonb_build_object('status', 'ineligible', 'token_id', _row.id);
  END IF;

  UPDATE public.agent_login_tokens
     SET status = 'redeeming', redeeming_at = now()
   WHERE id = _row.id;

  RETURN jsonb_build_object('status', 'claimed', 'token_id', _row.id, 'user_id', _row.user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_agent_login_token(p_token_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _n int;
BEGIN
  PERFORM public.assert_service_role();
  UPDATE public.agent_login_tokens
     SET status = 'redeemed', redeemed_at = now()
   WHERE id = p_token_id AND status = 'redeeming';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_agent_login_token(p_token_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _n int;
BEGIN
  PERFORM public.assert_service_role();
  UPDATE public.agent_login_tokens
     SET status = 'issued', redeeming_at = NULL
   WHERE id = p_token_id AND status = 'redeeming';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_agent_login_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_agent_login_token(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_agent_login_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_agent_login_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_agent_login_token(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_agent_login_token(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- Stream classification: the new template belongs to `transactional`.
-- Unknown templates classify to NULL (unclaimable), so this is required.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_stream_for_template(p_template text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_template
    -- ---- Hot Sheet / listing-update stream (isolated) ----
    WHEN 'new-match-notification' THEN 'hot_sheet'
    WHEN 'hot-sheet-status-change' THEN 'hot_sheet'
    WHEN 'hot-sheet-subscriber-status-change' THEN 'hot_sheet'
    WHEN 'hot-sheet-subscriber-update' THEN 'hot_sheet'
    WHEN 'hot-sheet-alert' THEN 'hot_sheet'
    WHEN 'hot-sheet-preview-blast' THEN 'hot_sheet'
    WHEN 'hot-sheet-preview-blast-test' THEN 'hot_sheet'
    WHEN 'hot-sheet-invite' THEN 'hot_sheet'
    WHEN 'hot-sheet-comment' THEN 'hot_sheet'
    WHEN 'hot-sheet-agent-reply' THEN 'hot_sheet'
    WHEN 'price-change-notification' THEN 'hot_sheet'
    WHEN 'stale-listing-reminder' THEN 'hot_sheet'
    WHEN 'buyer-alert' THEN 'hot_sheet'
    WHEN 'seller-alert' THEN 'hot_sheet'
    WHEN 'reverse-prospecting' THEN 'hot_sheet'

    -- ---- Communications Center stream ----
    WHEN 'client-need-broadcast' THEN 'communications'
    WHEN 'client-need-notification' THEN 'communications'
    WHEN 'comms-digest' THEN 'communications'
    WHEN 'comms-center-guide' THEN 'communications'
    WHEN 'bulk-email' THEN 'communications'
    WHEN 'bulk-email-group' THEN 'communications'

    -- ---- Transactional (agent/client initiated + account lifecycle) ----
    WHEN 'agent-profile-contact' THEN 'transactional'
    WHEN 'listing-contact-inquiry' THEN 'transactional'
    WHEN 'agent-client-email' THEN 'transactional'
    WHEN 'client-agent-message' THEN 'transactional'
    WHEN 'new-message-notification' THEN 'transactional'
    WHEN 'showing-request' THEN 'transactional'
    WHEN 'listing-share' THEN 'transactional'
    WHEN 'bulk-listing-share' THEN 'transactional'
    WHEN 'favorites-share' THEN 'transactional'
    WHEN 'buyer-workspace-invite' THEN 'transactional'
    WHEN 'account-delegate-invite' THEN 'transactional'
    WHEN 'team-invite' THEN 'transactional'
    WHEN 'team-request-notification' THEN 'transactional'
    WHEN 'team-decision' THEN 'transactional'
    WHEN 'agent-invite' THEN 'transactional'
    WHEN 'admin-created-invite' THEN 'transactional'
    WHEN 'agent-forward-invite' THEN 'transactional'
    WHEN 'personal-forward-invite' THEN 'transactional'
    WHEN 'founder-invite-1to1' THEN 'transactional'
    WHEN 'welcome-email' THEN 'transactional'
    WHEN 'license-verified' THEN 'transactional'
    WHEN 'agent-login-link' THEN 'transactional'
    WHEN 'agent-approval-accepted' THEN 'transactional'
    WHEN 'agent-account-removed' THEN 'transactional'

    -- ---- System / admin operational ----
    WHEN 'agent-verification-submitted' THEN 'system'

    ELSE NULL
  END;
$$;
