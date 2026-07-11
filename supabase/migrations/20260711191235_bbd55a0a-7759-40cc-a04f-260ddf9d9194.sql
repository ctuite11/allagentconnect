
CREATE INDEX IF NOT EXISTS idx_amor_agent_sent_at
  ON public.agent_missing_opportunity_reminders (agent_id, sent_at DESC);

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
  _reserved integer := 0;
  _recent_exists boolean := false;
  _idempotency_key text;
  _payload jsonb;
BEGIN
  -- Cadence gate: at most one reminder per agent per rolling 7 days,
  -- across ALL event types. A new opportunity event may trigger the
  -- check, but it enqueues only when the agent has not received any
  -- reminder in the prior 7 days.
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_missing_opportunity_reminders
    WHERE agent_id = _agent_id
      AND sent_at > now() - interval '7 days'
  ) INTO _recent_exists;

  IF _recent_exists THEN
    RETURN jsonb_build_object(
      'reserved', false,
      'queued', false,
      'reason', 'cadence_7d'
    );
  END IF;

  -- Per-event dedup: never send the same event twice to the same agent.
  INSERT INTO public.agent_missing_opportunity_reminders
    (agent_id, event_type, event_id, email)
  VALUES (_agent_id, _event_type, _event_id, _email)
  ON CONFLICT (agent_id, event_type, event_id) DO NOTHING;

  GET DIAGNOSTICS _reserved = ROW_COUNT;

  IF _reserved = 0 THEN
    RETURN jsonb_build_object(
      'reserved', false,
      'queued', false,
      'reason', 'duplicate_event'
    );
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
