-- Email stream classification + channel-aware claim + Hot Sheet/Comms isolation.
-- Does NOT cancel/retry/modify status of existing email_jobs (except stream backfill).

-- 1) Stream column (NULL allowed for legacy rows only)
ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS stream text;

ALTER TABLE public.email_jobs
  DROP CONSTRAINT IF EXISTS email_jobs_stream_check;

ALTER TABLE public.email_jobs
  ADD CONSTRAINT email_jobs_stream_check
  CHECK (
    stream IS NULL
    OR stream = ANY (ARRAY[
      'hot_sheet'::text,
      'communications'::text,
      'transactional'::text,
      'system'::text
    ])
  );

COMMENT ON COLUMN public.email_jobs.stream IS
  'Immutable queue stream set at enqueue: hot_sheet | communications | transactional | system. NULL = legacy unclassified. New inserts must set stream.';

-- Clear any prior unsafe backfill of retired broad-listing jobs into hot_sheet.
UPDATE public.email_jobs
SET stream = NULL
WHERE
  payload->>'template' = 'agent-new-listing-alert'
  OR idempotency_key LIKE 'agent-new-listing:%';

-- Best-effort backfill for known templates (never includes agent-new-listing-alert).
UPDATE public.email_jobs
SET stream = 'hot_sheet'
WHERE stream IS NULL
  AND (
    payload->>'template' IN (
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
    )
    OR (
      payload->>'category' = 'hot_sheet_alerts'
      AND COALESCE(payload->>'template', '') <> 'agent-new-listing-alert'
      AND COALESCE(idempotency_key, '') NOT LIKE 'agent-new-listing:%'
    )
    OR idempotency_key LIKE 'hs-agent:%'
    OR idempotency_key LIKE 'hs:%'
    OR idempotency_key LIKE 'hss:%'
    OR idempotency_key LIKE 'hotsheet-%'
    OR idempotency_key LIKE 'hot_sheet_invite:%'
    OR idempotency_key LIKE 'hot_sheet_comment:%'
    OR idempotency_key LIKE 'hot_sheet_agent_reply:%'
  );

UPDATE public.email_jobs
SET stream = 'communications'
WHERE stream IS NULL
  AND (
    payload->>'template' IN (
      'client-need-notification',
      'client-need-broadcast',
      'comms-digest',
      'buyer-alert',
      'seller-alert',
      'comms-center-guide',
      'reverse-prospecting'
    )
    OR idempotency_key LIKE 'client-need:%'
    OR idempotency_key LIKE 'client-need-broadcast:%'
    OR idempotency_key LIKE 'comms-digest:%'
    OR idempotency_key LIKE 'seller-alert:%'
    OR idempotency_key LIKE 'comms:%'
  );

UPDATE public.email_jobs
SET stream = 'transactional'
WHERE stream IS NULL
  AND payload->>'template' IN (
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
  );

UPDATE public.email_jobs
SET stream = 'system'
WHERE stream IS NULL
  AND payload->>'template' IN (
    'agent-verification-submitted'
  );

CREATE INDEX IF NOT EXISTS idx_email_jobs_stream_queue
  ON public.email_jobs (stream, status, run_after, created_at)
  WHERE status = 'queued';

-- 2) Immutable stream enforcement for NEW rows + UPDATE of stream
CREATE OR REPLACE FUNCTION public.email_jobs_enforce_stream_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stream IS NULL OR NEW.stream NOT IN (
    'hot_sheet', 'communications', 'transactional', 'system'
  ) THEN
    RAISE EXCEPTION
      'email_jobs.stream is required on insert (got %)',
      COALESCE(NEW.stream, '<null>');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_jobs_stream_insert ON public.email_jobs;
CREATE TRIGGER trg_email_jobs_stream_insert
  BEFORE INSERT ON public.email_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.email_jobs_enforce_stream_insert();

CREATE OR REPLACE FUNCTION public.email_jobs_enforce_stream_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stream IS DISTINCT FROM OLD.stream THEN
    RAISE EXCEPTION
      'email_jobs.stream is immutable after insert (old=%, new=%)',
      OLD.stream, NEW.stream;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_jobs_stream_immutable ON public.email_jobs;
CREATE TRIGGER trg_email_jobs_stream_immutable
  BEFORE UPDATE OF stream ON public.email_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.email_jobs_enforce_stream_immutable();

-- 3) Channel-aware claim: exclude paused streams AND retired broad-listing jobs.
CREATE OR REPLACE FUNCTION public.email_jobs_claim(
  p_limit integer,
  p_allowed_streams text[] DEFAULT NULL
)
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT ej.id
    FROM public.email_jobs ej
    WHERE ej.status = 'queued'
      AND ej.run_after <= now()
      AND ej.stream IS NOT NULL
      AND p_allowed_streams IS NOT NULL
      AND cardinality(p_allowed_streams) > 0
      AND ej.stream = ANY (p_allowed_streams)
      -- Permanent quarantine: retired broad listing pipeline
      AND COALESCE(ej.payload->>'template', '') <> 'agent-new-listing-alert'
      AND COALESCE(ej.idempotency_key, '') NOT LIKE 'agent-new-listing:%'
    ORDER BY ej.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
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
GRANT EXECUTE ON FUNCTION public.email_jobs_claim(integer) TO service_role;

-- 4) Drop Hot Sheet → client_needs bridge (keep historical rows).
DROP TRIGGER IF EXISTS sync_hot_sheet_to_client_needs_trigger ON public.hot_sheets;
DROP TRIGGER IF EXISTS delete_hot_sheet_client_needs_trigger ON public.hot_sheets;
DROP FUNCTION IF EXISTS public.sync_hot_sheet_to_client_needs();
DROP FUNCTION IF EXISTS public.delete_hot_sheet_client_needs();

-- Defense in depth: still skip Comms notify for historical Hot-Sheet-synced rows.
CREATE OR REPLACE FUNCTION public.notify_agents_of_client_need()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  IF NEW.description IS NOT NULL
     AND NEW.description LIKE 'Auto-generated from hot sheet:%' THEN
    RAISE LOG 'Skipping Comms notify for historical Hot-Sheet-synced client_need %', NEW.id;
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := supabase_url || '/functions/v1/notify-agents-client-need',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'client_need_id', NEW.id,
      'state', NEW.state,
      'city', NEW.city,
      'property_type', NEW.property_type,
      'max_price', NEW.max_price,
      'bedrooms', NEW.bedrooms,
      'bathrooms', NEW.bathrooms,
      'description', NEW.description
    )
  ) INTO request_id;

  RAISE LOG 'Triggered client need notification for % with request_id %', NEW.id, request_id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger client need notification for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
