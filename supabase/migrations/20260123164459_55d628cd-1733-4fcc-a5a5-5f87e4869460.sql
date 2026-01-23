-- Email Queue System: email_jobs + email_events tables

-- Create email_jobs table for queued email sends
CREATE TABLE public.email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  last_error TEXT,
  payload JSONB NOT NULL
);

-- Create index for efficient queue processing
CREATE INDEX idx_email_jobs_queue ON public.email_jobs (status, run_after, created_at) 
WHERE status IN ('queued', 'processing');

-- Create email_events table for audit trail
CREATE TABLE public.email_events (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.email_jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event TEXT NOT NULL,
  detail JSONB
);

CREATE INDEX idx_email_events_job_id ON public.email_events (job_id);

-- Lock down tables: revoke direct access from anon/authenticated
REVOKE ALL ON public.email_jobs FROM anon, authenticated;
REVOKE ALL ON public.email_events FROM anon, authenticated;

-- Grant usage on sequence for service role
GRANT USAGE, SELECT ON SEQUENCE public.email_events_id_seq TO service_role;
GRANT ALL ON public.email_jobs TO service_role;
GRANT ALL ON public.email_events TO service_role;

-- Enable RLS but with no policies (only service_role can access)
ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Create RPC to atomically claim email jobs for processing
CREATE OR REPLACE FUNCTION public.email_jobs_claim(p_limit INT)
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

-- Only service_role can execute the claim function
REVOKE ALL ON FUNCTION public.email_jobs_claim(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_jobs_claim(INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_jobs_claim(INT) TO service_role;