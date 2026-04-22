DROP VIEW IF EXISTS public.email_jobs_delivery_status;

CREATE VIEW public.email_jobs_delivery_status
WITH (security_invoker = true) AS
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

REVOKE ALL ON public.email_jobs_delivery_status FROM anon;
GRANT SELECT ON public.email_jobs_delivery_status TO authenticated;