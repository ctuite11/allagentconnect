-- ============================================================
-- Email stream isolation hotfix (production-local)
-- Adds email_jobs.stream, fail-closed classification, immutability,
-- permanent block on retired listing-alert jobs, channel-aware claim.
-- ============================================================

ALTER TABLE public.email_jobs ADD COLUMN IF NOT EXISTS stream text;

ALTER TABLE public.email_jobs DROP CONSTRAINT IF EXISTS email_jobs_stream_check;
ALTER TABLE public.email_jobs ADD CONSTRAINT email_jobs_stream_check
  CHECK (stream IS NULL OR stream IN ('hot_sheet','communications','transactional','system'));

-- Permanently retired listing-alert jobs (never classified, never sendable)
CREATE OR REPLACE FUNCTION public.email_job_is_blocked(p_template text, p_idempotency_key text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(p_template, '') = 'agent-new-listing-alert'
      OR coalesce(p_idempotency_key, '') LIKE 'agent-new-listing:%';
$$;

-- Explicit template -> stream allowlist. Anything unknown returns NULL and
-- therefore can never be claimed or sent (fail closed).
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
    WHEN 'agent-approval-accepted' THEN 'transactional'
    WHEN 'agent-account-removed' THEN 'transactional'

    -- ---- System / admin operational ----
    WHEN 'agent-verification-submitted' THEN 'system'

    ELSE NULL
  END;
$$;

-- Backfill existing rows from the allowlist (retired listing alerts stay NULL).
UPDATE public.email_jobs
SET stream = public.email_stream_for_template(payload->>'template')
WHERE stream IS NULL
  AND NOT public.email_job_is_blocked(payload->>'template', idempotency_key);

-- Insert guard: hard-block retired alerts, derive/validate stream, fail closed.
CREATE OR REPLACE FUNCTION public.email_jobs_enforce_stream()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_template text := NEW.payload->>'template';
  v_expected text := public.email_stream_for_template(NEW.payload->>'template');
BEGIN
  IF public.email_job_is_blocked(v_template, NEW.idempotency_key) THEN
    RAISE EXCEPTION 'email_jobs: template/idempotency_key is permanently retired (%).', coalesce(v_template, 'null');
  END IF;

  IF NEW.stream IS NULL THEN
    NEW.stream := v_expected;   -- NULL when unknown -> unclaimable, fail closed
  ELSIF v_expected IS NULL OR NEW.stream <> v_expected THEN
    NEW.stream := NULL;         -- mismatched -> unclaimable, fail closed
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_jobs_enforce_stream_ins ON public.email_jobs;
CREATE TRIGGER email_jobs_enforce_stream_ins
  BEFORE INSERT ON public.email_jobs
  FOR EACH ROW EXECUTE FUNCTION public.email_jobs_enforce_stream();

-- Stream is immutable after insertion.
CREATE OR REPLACE FUNCTION public.email_jobs_stream_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stream IS DISTINCT FROM OLD.stream THEN
    RAISE EXCEPTION 'email_jobs.stream is immutable after insertion';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_jobs_stream_immutable_upd ON public.email_jobs;
CREATE TRIGGER email_jobs_stream_immutable_upd
  BEFORE UPDATE ON public.email_jobs
  FOR EACH ROW EXECUTE FUNCTION public.email_jobs_stream_immutable();

-- Channel-aware claim. p_streams NULL => claim nothing (fail closed).
CREATE OR REPLACE FUNCTION public.email_jobs_claim(p_limit integer, p_streams text[])
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_streams IS NULL OR array_length(p_streams, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH claimed AS (
    SELECT ej.id
    FROM public.email_jobs ej
    WHERE ej.status = 'queued'
      AND ej.run_after <= now()
      AND ej.stream IS NOT NULL
      AND ej.stream = ANY (p_streams)
      AND NOT public.email_job_is_blocked(ej.payload->>'template', ej.idempotency_key)
      AND ej.stream = public.email_stream_for_template(ej.payload->>'template')
    ORDER BY ej.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.email_jobs
  SET status = 'processing',
      attempts = attempts + 1
  FROM claimed
  WHERE email_jobs.id = claimed.id
  RETURNING email_jobs.*;
END;
$$;

-- Legacy single-arg entrypoint now claims nothing (fail closed).
CREATE OR REPLACE FUNCTION public.email_jobs_claim(p_limit integer)
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.email_jobs_claim(integer, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_jobs_claim(integer, text[]) TO service_role;
REVOKE ALL ON FUNCTION public.email_jobs_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_jobs_claim(integer) TO service_role;

CREATE INDEX IF NOT EXISTS idx_email_jobs_stream_status_runafter
  ON public.email_jobs (stream, status, run_after);

-- === ROLLBACK NOTES ===
-- DROP TRIGGER email_jobs_enforce_stream_ins ON public.email_jobs;
-- DROP TRIGGER email_jobs_stream_immutable_upd ON public.email_jobs;
-- DROP FUNCTION public.email_jobs_claim(integer, text[]);
-- Restore the previous single-arg email_jobs_claim body; ALTER TABLE public.email_jobs DROP COLUMN stream;