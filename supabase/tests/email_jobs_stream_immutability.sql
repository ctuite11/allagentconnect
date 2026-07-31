-- Database verification for email_jobs.stream immutability + insert requirement.
-- Run against a non-production database after applying:
--   20260730200000_email_stream_channel_claim.sql
--   20260730210000_email_jobs_stream_sql_producers.sql
-- Do NOT run against production queue data.

BEGIN;

-- 1) New row without stream must be rejected.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.email_jobs (payload)
    VALUES (
      jsonb_build_object(
        'provider', 'resend',
        'template', 'welcome-email',
        'to', 'stream-immutability-test@example.com',
        'subject', 'stream insert required'
      )
    );
    RAISE EXCEPTION 'expected insert without stream to fail';
  EXCEPTION
    WHEN others THEN
      IF SQLERRM NOT LIKE '%email_jobs.stream is required on insert%' THEN
        RAISE;
      END IF;
  END;
END;
$$;

-- 2) Valid stream can be set at insertion.
INSERT INTO public.email_jobs (stream, payload, idempotency_key)
VALUES (
  'transactional',
  jsonb_build_object(
    'provider', 'resend',
    'template', 'welcome-email',
    'to', 'stream-immutability-test@example.com',
    'subject', 'stream insert ok'
  ),
  'test:stream-immutability:' || gen_random_uuid()::text
);

-- 3) Stream cannot be changed after insertion.
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.email_jobs
  WHERE payload->>'to' = 'stream-immutability-test@example.com'
  ORDER BY created_at DESC
  LIMIT 1;

  BEGIN
    UPDATE public.email_jobs
    SET stream = 'system'
    WHERE id = v_id;
    RAISE EXCEPTION 'expected stream update to fail';
  EXCEPTION
    WHEN others THEN
      IF SQLERRM NOT LIKE '%email_jobs.stream is immutable after insert%' THEN
        RAISE;
      END IF;
  END;
END;
$$;

ROLLBACK;
