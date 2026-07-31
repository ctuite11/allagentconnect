-- Ground Zero Phase A: email control state, hardened claim, required idempotency.
-- Does NOT migrate historical jobs into sendable state.
-- Ground Zero boundary (UTC): 2026-07-31 04:00:00  (= America/New_York 2026-07-31 00:00:00)

-- ---------------------------------------------------------------------------
-- 1) Status: allow quarantined
-- ---------------------------------------------------------------------------
ALTER TABLE public.email_jobs
  DROP CONSTRAINT IF EXISTS chk_email_job_status;

ALTER TABLE public.email_jobs
  ADD CONSTRAINT chk_email_job_status
  CHECK (status IN (
    'queued',
    'processing',
    'sent',
    'failed',
    'cancelled',
    'quarantined'
  ));

-- ---------------------------------------------------------------------------
-- 2) Singleton email control state (all pauses TRUE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_control_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ground_zero_at timestamptz NOT NULL
    DEFAULT '2026-07-31 04:00:00+00'::timestamptz,
  global_paused boolean NOT NULL DEFAULT true,
  hot_sheet_paused boolean NOT NULL DEFAULT true,
  communications_paused boolean NOT NULL DEFAULT true,
  transactional_paused boolean NOT NULL DEFAULT true,
  system_paused boolean NOT NULL DEFAULT true,
  changed_by uuid NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  change_reason text NOT NULL DEFAULT 'ground_zero_init',
  last_auto_shutdown_reason text NULL,
  last_auto_shutdown_at timestamptz NULL,
  last_auto_shutdown_source_event text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_control_state IS
  'Singleton email safety control plane. All pauses initialize true (fail closed).';

INSERT INTO public.email_control_state (
  id,
  ground_zero_at,
  global_paused,
  hot_sheet_paused,
  communications_paused,
  transactional_paused,
  system_paused,
  change_reason
)
VALUES (
  true,
  '2026-07-31 04:00:00+00'::timestamptz,
  true,
  true,
  true,
  true,
  true,
  'ground_zero_init'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.email_control_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_control_state FROM PUBLIC;
REVOKE ALL ON public.email_control_state FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.email_control_state TO service_role;

DROP POLICY IF EXISTS email_control_state_admin_select ON public.email_control_state;
CREATE POLICY email_control_state_admin_select
  ON public.email_control_state
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 3) Template → stream allowlist (SQL mirror of emailStreams.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_expected_stream(p_template text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_template IS NULL OR btrim(p_template) = '' THEN NULL
    WHEN p_template = 'agent-new-listing-alert' THEN NULL
    WHEN p_template = ANY (ARRAY[
      'new-match-notification',
      'hot-sheet-status-change',
      'hot-sheet-subscriber-update',
      'hot-sheet-subscriber-status-change',
      'hot-sheet-alert',
      'hot-sheet-invite',
      'hot-sheet-comment',
      'hot-sheet-agent-reply',
      'hot-sheet-preview-blast',
      'hot-sheet-preview-blast-test'
    ]) THEN 'hot_sheet'
    WHEN p_template = ANY (ARRAY[
      'client-need-notification',
      'client-need-broadcast',
      'comms-digest',
      'buyer-alert',
      'seller-alert',
      'comms-center-guide',
      'reverse-prospecting'
    ]) THEN 'communications'
    WHEN p_template = ANY (ARRAY[
      'agent-verification-submitted'
    ]) THEN 'system'
    WHEN p_template = ANY (ARRAY[
      'listing-share',
      'bulk-listing-share',
      'favorites-share',
      'new-message-notification',
      'client-agent-message',
      'buyer-workspace-invite',
      'account-delegate-invite',
      'agent-approval-accepted',
      'agent-approval-rejected',
      'agent-account-removed',
      'agent-client-email',
      'welcome-email',
      'showing-request',
      'listing-contact-inquiry',
      'price-change-notification',
      'stale-listing-reminder',
      'personal-forward-invite',
      'agent-invite',
      'agent-forward-invite',
      'team-approved',
      'team-rejected',
      'team-invite',
      'team-request-notification',
      'founder-invite-1to1',
      'license-verified',
      'agent-profile-contact',
      'agent-missing-opportunities',
      'bulk-email',
      'bulk-email-group',
      'new-listing-alert',
      'admin-created-invite'
    ]) THEN 'transactional'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.email_expected_stream(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_expected_stream(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_expected_stream(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.email_is_retired_template(
  p_template text,
  p_idempotency_key text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE(p_template, '') = 'agent-new-listing-alert'
    OR COALESCE(p_idempotency_key, '') LIKE 'agent-new-listing:%';
$$;

REVOKE ALL ON FUNCTION public.email_is_retired_template(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_is_retired_template(text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Required non-null idempotency_key on insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_jobs_enforce_idempotency_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.idempotency_key IS NULL OR btrim(NEW.idempotency_key) = '' THEN
    RAISE EXCEPTION 'email_jobs.idempotency_key is required on insert';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_jobs_idempotency_insert ON public.email_jobs;
CREATE TRIGGER trg_email_jobs_idempotency_insert
  BEFORE INSERT ON public.email_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.email_jobs_enforce_idempotency_insert();

-- ---------------------------------------------------------------------------
-- 5) Claim helpers: DB pause + Ground Zero eligibility
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_control_is_stream_paused(p_stream text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.email_control_state%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.email_control_state WHERE id = true;
  IF NOT FOUND THEN
    RETURN true; -- fail closed
  END IF;
  IF s.global_paused THEN
    RETURN true;
  END IF;
  RETURN CASE p_stream
    WHEN 'hot_sheet' THEN s.hot_sheet_paused
    WHEN 'communications' THEN s.communications_paused
    WHEN 'transactional' THEN s.transactional_paused
    WHEN 'system' THEN s.system_paused
    ELSE true
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.email_control_is_stream_paused(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_control_is_stream_paused(text) TO service_role;

CREATE OR REPLACE FUNCTION public.email_job_is_claimable(ej public.email_jobs)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_gz timestamptz;
  v_template text;
  v_expected text;
BEGIN
  SELECT ground_zero_at INTO v_gz
  FROM public.email_control_state
  WHERE id = true;

  IF v_gz IS NULL THEN
    RETURN false;
  END IF;

  -- Historical / pre-Ground-Zero rows are permanently unclaimable.
  IF ej.created_at < v_gz THEN
    RETURN false;
  END IF;

  IF ej.status IS DISTINCT FROM 'queued' THEN
    RETURN false;
  END IF;

  IF ej.stream IS NULL
     OR ej.stream NOT IN ('hot_sheet', 'communications', 'transactional', 'system') THEN
    RETURN false;
  END IF;

  IF public.email_control_is_stream_paused(ej.stream) THEN
    RETURN false;
  END IF;

  v_template := COALESCE(ej.payload->>'template', '');

  IF public.email_is_retired_template(v_template, ej.idempotency_key) THEN
    RETURN false;
  END IF;

  v_expected := public.email_expected_stream(v_template);
  IF v_expected IS NULL THEN
    RETURN false;
  END IF;

  IF ej.stream IS DISTINCT FROM v_expected THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.email_job_is_claimable(public.email_jobs) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_job_is_claimable(public.email_jobs) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Hardened channel-aware claim (clamp to 5, Ground Zero + DB pauses)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_jobs_claim(
  p_limit integer,
  p_allowed_streams text[] DEFAULT NULL
)
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit integer;
  v_global_paused boolean;
BEGIN
  v_limit := LEAST(5, GREATEST(COALESCE(p_limit, 0), 0));

  SELECT global_paused INTO v_global_paused
  FROM public.email_control_state
  WHERE id = true;

  -- Fail closed: missing control row or global pause ⇒ claim nothing.
  IF v_global_paused IS DISTINCT FROM false THEN
    RETURN;
  END IF;

  IF p_allowed_streams IS NULL OR cardinality(p_allowed_streams) = 0 THEN
    RETURN;
  END IF;

  IF v_limit <= 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH claimed AS (
    SELECT ej.id
    FROM public.email_jobs ej
    WHERE ej.status = 'queued'
      AND ej.run_after <= now()
      AND ej.stream = ANY (p_allowed_streams)
      AND public.email_job_is_claimable(ej)
    ORDER BY ej.created_at
    FOR UPDATE OF ej SKIP LOCKED
    LIMIT v_limit
  )
  UPDATE public.email_jobs
  SET
    status = 'processing',
    attempts = attempts + 1
  FROM claimed
  WHERE email_jobs.id = claimed.id
  RETURNING email_jobs.*;
END;
$$;

REVOKE ALL ON FUNCTION public.email_jobs_claim(integer, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_jobs_claim(integer, text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_jobs_claim(integer, text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.email_jobs_claim(p_limit integer)
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.email_jobs_claim(
    p_limit,
    ARRAY['transactional', 'system']::text[]
  );
END;
$$;

REVOKE ALL ON FUNCTION public.email_jobs_claim(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_jobs_claim(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_jobs_claim(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 7) Read helpers for workers / admin dashboard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_control_get()
RETURNS public.email_control_state
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.email_control_state WHERE id = true;
$$;

REVOKE ALL ON FUNCTION public.email_control_get() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_control_get() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_control_get() TO authenticated;
