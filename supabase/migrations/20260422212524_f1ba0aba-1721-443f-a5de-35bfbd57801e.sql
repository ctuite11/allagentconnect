-- Add provider correlation columns for Resend webhook tracking
ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_status_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_email_jobs_provider_message_id
  ON public.email_jobs(provider_message_id);

ALTER TABLE public.email_events
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS provider_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'worker';

CREATE INDEX IF NOT EXISTS idx_email_events_provider_message_id
  ON public.email_events(provider_message_id);

CREATE INDEX IF NOT EXISTS idx_email_events_event
  ON public.email_events(event);

-- Admin diagnostic view: latest delivery state per email job
CREATE OR REPLACE VIEW public.email_jobs_delivery_status AS
SELECT
  j.id AS job_id,
  j.status AS queue_status,
  j.delivery_status,
  j.delivery_status_at,
  j.provider_message_id,
  j.payload->>'template' AS template,
  j.payload->>'to' AS recipient,
  j.payload->>'subject' AS subject,
  j.created_at,
  j.last_error,
  j.attempts,
  j.max_attempts
FROM public.email_jobs j;

-- Restrict the view to admins only
REVOKE ALL ON public.email_jobs_delivery_status FROM anon, authenticated;
GRANT SELECT ON public.email_jobs_delivery_status TO authenticated;