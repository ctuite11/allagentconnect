CREATE INDEX IF NOT EXISTS idx_email_jobs_template_created_at
  ON public.email_jobs ((payload->>'template'), created_at DESC);