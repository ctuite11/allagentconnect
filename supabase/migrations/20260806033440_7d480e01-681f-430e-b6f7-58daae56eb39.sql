CREATE INDEX IF NOT EXISTS idx_email_jobs_payload_to_created_at
  ON public.email_jobs ((payload ->> 'to'), created_at DESC);