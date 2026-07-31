-- Unsent digest scheduling state first (FK order: items -> sends -> email_jobs)
DELETE FROM public.comms_digest_items WHERE digest_send_id IS NULL;
DELETE FROM public.comms_digest_items
  WHERE digest_send_id IN (SELECT id FROM public.comms_digest_sends WHERE status IS DISTINCT FROM 'sent');
DELETE FROM public.comms_digest_sends WHERE status IS DISTINCT FROM 'sent';

-- All email jobs that could still be delivered. 'sent' rows are preserved.
DELETE FROM public.email_jobs
WHERE status IN ('queued','pending','processing','scheduled','retrying');