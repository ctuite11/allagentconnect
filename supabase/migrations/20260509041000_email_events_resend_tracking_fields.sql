-- Persist Resend webhook data needed for delivery tracking/audit.
-- Reuse email_events table and add explicit columns requested by product.

ALTER TABLE public.email_events
  ALTER COLUMN job_id DROP NOT NULL;

ALTER TABLE public.email_events
  ADD COLUMN IF NOT EXISTS resend_email_id text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS recipient text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;

-- Helpful indexes for webhook lookups/audits.
CREATE INDEX IF NOT EXISTS idx_email_events_resend_email_id
  ON public.email_events (resend_email_id);

CREATE INDEX IF NOT EXISTS idx_email_events_event_type
  ON public.email_events (event_type);

