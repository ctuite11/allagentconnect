-- Ground Zero Phase C: immutable delivery ledger + automatic emergency shutdown.

-- ---------------------------------------------------------------------------
-- 1) Append-only delivery ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_delivery_ledger (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  job_id uuid NOT NULL REFERENCES public.email_jobs(id) ON DELETE RESTRICT,
  recipient_email text NOT NULL,
  template text NOT NULL,
  stream text NOT NULL,
  source_event_id text NULL,
  worker_request_id text NOT NULL,
  claimed_at timestamptz NULL,
  provider_call_at timestamptz NULL,
  provider_message_id text NULL,
  result text NOT NULL,
  failure_reason text NULL
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_ledger_job
  ON public.email_delivery_ledger (job_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_ledger_created
  ON public.email_delivery_ledger (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_delivery_ledger_recipient
  ON public.email_delivery_ledger (recipient_email, created_at DESC);

ALTER TABLE public.email_delivery_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_delivery_ledger FROM PUBLIC;
REVOKE ALL ON public.email_delivery_ledger FROM anon, authenticated;
GRANT SELECT, INSERT ON public.email_delivery_ledger TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.email_delivery_ledger_id_seq TO service_role;

DROP POLICY IF EXISTS email_delivery_ledger_admin_select ON public.email_delivery_ledger;
CREATE POLICY email_delivery_ledger_admin_select
  ON public.email_delivery_ledger
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Immutable: block UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.email_delivery_ledger_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'email_delivery_ledger is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_email_delivery_ledger_no_update ON public.email_delivery_ledger;
CREATE TRIGGER trg_email_delivery_ledger_no_update
  BEFORE UPDATE OR DELETE ON public.email_delivery_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.email_delivery_ledger_immutable();

CREATE OR REPLACE FUNCTION public.email_delivery_ledger_append(
  p_job_id uuid,
  p_recipient_email text,
  p_template text,
  p_stream text,
  p_source_event_id text,
  p_worker_request_id text,
  p_claimed_at timestamptz,
  p_provider_call_at timestamptz,
  p_provider_message_id text,
  p_result text,
  p_failure_reason text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO public.email_delivery_ledger (
    job_id,
    recipient_email,
    template,
    stream,
    source_event_id,
    worker_request_id,
    claimed_at,
    provider_call_at,
    provider_message_id,
    result,
    failure_reason
  ) VALUES (
    p_job_id,
    p_recipient_email,
    p_template,
    p_stream,
    p_source_event_id,
    p_worker_request_id,
    p_claimed_at,
    p_provider_call_at,
    p_provider_message_id,
    p_result,
    p_failure_reason
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.email_delivery_ledger_append(
  uuid, text, text, text, text, text, timestamptz, timestamptz, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_delivery_ledger_append(
  uuid, text, text, text, text, text, timestamptz, timestamptz, text, text, text
) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Automatic global pause
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_control_trip_global_pause(
  p_reason text,
  p_source_event_id text DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
RETURNS public.email_control_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.email_control_state%ROWTYPE;
BEGIN
  UPDATE public.email_control_state
  SET
    global_paused = true,
    changed_by = p_actor,
    changed_at = now(),
    change_reason = COALESCE(p_reason, 'automatic_shutdown'),
    last_auto_shutdown_reason = COALESCE(p_reason, 'automatic_shutdown'),
    last_auto_shutdown_at = now(),
    last_auto_shutdown_source_event = p_source_event_id,
    updated_at = now()
  WHERE id = true
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'email_control_state missing';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.email_control_trip_global_pause(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_control_trip_global_pause(text, text, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.email_safety_evaluate_and_trip(
  p_reason text DEFAULT NULL,
  p_source_event_id text DEFAULT NULL,
  p_worker_error_rate numeric DEFAULT NULL,
  p_force_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_provider_calls_1m integer;
  v_max_fanout integer;
  v_max_recipient_1h integer;
  v_trip_reason text := NULL;
BEGIN
  IF p_force_reason IS NOT NULL AND btrim(p_force_reason) <> '' THEN
    v_trip_reason := p_force_reason;
  ELSE
    SELECT COUNT(*)::integer INTO v_provider_calls_1m
    FROM public.email_delivery_ledger
    WHERE provider_call_at IS NOT NULL
      AND provider_call_at >= now() - interval '1 minute';

    IF v_provider_calls_1m > 20 THEN
      v_trip_reason := 'provider_calls_exceeded_20_per_minute';
    END IF;

    IF v_trip_reason IS NULL THEN
      SELECT COALESCE(MAX(recipient_count), 0) INTO v_max_fanout
      FROM public.email_source_events
      WHERE approved = false
        AND created_at >= now() - interval '24 hours';

      IF v_max_fanout > 50 THEN
        v_trip_reason := 'unapproved_event_recipients_exceeded_50';
      END IF;
    END IF;

    IF v_trip_reason IS NULL THEN
      SELECT COALESCE(MAX(c.cnt), 0) INTO v_max_recipient_1h
      FROM (
        SELECT recipient_email, COUNT(*)::integer AS cnt
        FROM public.email_delivery_ledger
        WHERE created_at >= now() - interval '1 hour'
          AND result IN ('sent', 'provider_called', 'claimed')
        GROUP BY recipient_email
      ) c;

      IF v_max_recipient_1h > 5 THEN
        v_trip_reason := 'recipient_exceeded_5_emails_per_hour';
      END IF;
    END IF;

    IF v_trip_reason IS NULL
       AND p_worker_error_rate IS NOT NULL
       AND p_worker_error_rate > 0.20 THEN
      v_trip_reason := 'worker_provider_error_rate_exceeded_20pct';
    END IF;

    IF v_trip_reason IS NULL AND p_reason IS NOT NULL AND btrim(p_reason) <> '' THEN
      -- Explicit safety reasons from worker (unknown template, mismatch, retired)
      IF p_reason IN (
        'unknown_template',
        'retired_broad_listing',
        'stream_template_mismatch'
      ) THEN
        v_trip_reason := p_reason;
      END IF;
    END IF;
  END IF;

  IF v_trip_reason IS NULL THEN
    RETURN jsonb_build_object('tripped', false);
  END IF;

  PERFORM public.email_control_trip_global_pause(
    v_trip_reason,
    p_source_event_id,
    NULL
  );

  RETURN jsonb_build_object(
    'tripped', true,
    'reason', v_trip_reason,
    'source_event_id', p_source_event_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.email_safety_evaluate_and_trip(text, text, numeric, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_safety_evaluate_and_trip(text, text, numeric, text)
  TO service_role;
