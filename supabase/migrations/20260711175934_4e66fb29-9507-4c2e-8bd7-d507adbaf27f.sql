
-- 1) Dedup table for the missing-opportunities reminder
CREATE TABLE IF NOT EXISTS public.agent_missing_opportunity_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  event_type text NOT NULL,
  event_id uuid NOT NULL,
  email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, event_type, event_id)
);

GRANT ALL ON public.agent_missing_opportunity_reminders TO service_role;

ALTER TABLE public.agent_missing_opportunity_reminders ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies: service_role bypasses RLS; no other role reads/writes.

CREATE INDEX IF NOT EXISTS idx_amor_event
  ON public.agent_missing_opportunity_reminders (event_type, event_id);

CREATE INDEX IF NOT EXISTS idx_amor_agent
  ON public.agent_missing_opportunity_reminders (agent_id);

-- 2) Reserve-first transactional RPC. Reservation is inserted first with
--    ON CONFLICT DO NOTHING; the email_jobs insert runs only if the
--    reservation succeeded. Any failure in the email insert raises and
--    rolls back the reservation for a clean retry.
CREATE OR REPLACE FUNCTION public.reserve_and_enqueue_missing_opportunity_reminder(
  _agent_id uuid,
  _event_type text,
  _event_id uuid,
  _email text,
  _email_job jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _reserved boolean := false;
  _idempotency_key text;
  _payload jsonb;
BEGIN
  INSERT INTO public.agent_missing_opportunity_reminders
    (agent_id, event_type, event_id, email)
  VALUES (_agent_id, _event_type, _event_id, _email)
  ON CONFLICT (agent_id, event_type, event_id) DO NOTHING;

  GET DIAGNOSTICS _reserved = ROW_COUNT;

  IF _reserved = 0 THEN
    RETURN jsonb_build_object('reserved', false, 'queued', false);
  END IF;

  _idempotency_key := _email_job->>'idempotency_key';
  _payload := _email_job->'payload';

  INSERT INTO public.email_jobs (idempotency_key, payload)
  VALUES (_idempotency_key, _payload);

  RETURN jsonb_build_object('reserved', true, 'queued', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_and_enqueue_missing_opportunity_reminder(uuid, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_and_enqueue_missing_opportunity_reminder(uuid, text, uuid, text, jsonb) TO service_role;
