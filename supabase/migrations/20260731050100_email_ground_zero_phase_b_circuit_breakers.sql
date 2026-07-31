-- Ground Zero Phase B: fan-out circuit breakers, frequency caps, atomic enqueue.
-- Depends on Phase A (email_control_state, email_expected_stream, quarantined status).

-- ---------------------------------------------------------------------------
-- 1) Source-event fan-out reservation / quarantine
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_source_events (
  source_event_id text PRIMARY KEY,
  stream text NOT NULL CHECK (
    stream IN ('hot_sheet', 'communications', 'transactional', 'system')
  ),
  template text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  job_count integer NOT NULL DEFAULT 0 CHECK (job_count >= 0),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'queued', 'quarantined', 'aborted', 'completed')),
  quarantine_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_source_events_status
  ON public.email_source_events (status, created_at DESC);

ALTER TABLE public.email_source_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_source_events FROM PUBLIC;
REVOKE ALL ON public.email_source_events FROM anon, authenticated;
GRANT ALL ON public.email_source_events TO service_role;

DROP POLICY IF EXISTS email_source_events_admin_select ON public.email_source_events;
CREATE POLICY email_source_events_admin_select
  ON public.email_source_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 2) Frequency suppression audit (optional observability)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_frequency_suppressions (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  recipient_email text NOT NULL,
  stream text NOT NULL,
  template text NULL,
  source_event_id text NULL,
  reason text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_frequency_suppressions_created
  ON public.email_frequency_suppressions (created_at DESC);

ALTER TABLE public.email_frequency_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_frequency_suppressions FROM PUBLIC;
REVOKE ALL ON public.email_frequency_suppressions FROM anon, authenticated;
GRANT ALL ON public.email_frequency_suppressions TO service_role;

DROP POLICY IF EXISTS email_frequency_suppressions_admin_select
  ON public.email_frequency_suppressions;
CREATE POLICY email_frequency_suppressions_admin_select
  ON public.email_frequency_suppressions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 3) Frequency cap helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_recipient_send_count(
  p_recipient text,
  p_stream text DEFAULT NULL,
  p_window interval DEFAULT interval '24 hours',
  p_exclude_transactional boolean DEFAULT false
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.email_jobs ej
  WHERE lower(COALESCE(ej.payload->>'to', '')) = lower(p_recipient)
    AND ej.created_at >= now() - p_window
    AND ej.status IN ('queued', 'processing', 'sent')
    AND (
      p_stream IS NULL
      OR ej.stream = p_stream
    )
    AND (
      NOT p_exclude_transactional
      OR ej.stream NOT IN ('transactional', 'system')
    );
$$;

REVOKE ALL ON FUNCTION public.email_recipient_send_count(text, text, interval, boolean)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_recipient_send_count(text, text, interval, boolean)
  TO service_role;

CREATE OR REPLACE FUNCTION public.email_frequency_allows(
  p_recipient text,
  p_stream text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stream_count integer;
  v_non_txn_count integer;
  v_txn_count integer;
BEGIN
  IF p_recipient IS NULL OR btrim(p_recipient) = '' THEN
    RETURN false;
  END IF;

  IF p_stream IN ('hot_sheet', 'communications') THEN
    v_stream_count := public.email_recipient_send_count(
      p_recipient, p_stream, interval '24 hours', false
    );
    IF v_stream_count >= 3 THEN
      RETURN false;
    END IF;

    v_non_txn_count := public.email_recipient_send_count(
      p_recipient, NULL, interval '24 hours', true
    );
    IF v_non_txn_count >= 5 THEN
      RETURN false;
    END IF;

    RETURN true;
  END IF;

  -- transactional / system
  v_txn_count := public.email_recipient_send_count(
    p_recipient, p_stream, interval '24 hours', false
  );
  RETURN v_txn_count < 10;
END;
$$;

REVOKE ALL ON FUNCTION public.email_frequency_allows(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_frequency_allows(text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Atomic batch enqueue RPC
--    Jobs are inserted only if the entire batch is valid.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_jobs_enqueue_batch(
  p_source_event_id text,
  p_stream text,
  p_template text,
  p_jobs jsonb,
  p_approved boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expected text;
  v_job jsonb;
  v_count integer;
  v_recipients text[] := ARRAY[]::text[];
  v_recipient text;
  v_idem text;
  v_payload jsonb;
  v_inserted integer := 0;
  v_suppressed integer := 0;
  v_event public.email_source_events%ROWTYPE;
BEGIN
  IF p_source_event_id IS NULL OR btrim(p_source_event_id) = '' THEN
    RAISE EXCEPTION 'source_event_id is required';
  END IF;

  IF p_stream IS NULL OR p_stream NOT IN (
    'hot_sheet', 'communications', 'transactional', 'system'
  ) THEN
    RAISE EXCEPTION 'invalid stream %', COALESCE(p_stream, '<null>');
  END IF;

  IF public.email_is_retired_template(p_template, NULL) THEN
    INSERT INTO public.email_source_events AS ese (
      source_event_id, stream, template, approved, recipient_count, job_count,
      status, quarantine_reason
    ) VALUES (
      p_source_event_id, p_stream, p_template, p_approved, 0, 0,
      'quarantined', 'retired_template'
    )
    ON CONFLICT (source_event_id) DO UPDATE
      SET status = 'quarantined',
          quarantine_reason = 'retired_template',
          updated_at = now();

    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'retired_template',
      'inserted', 0,
      'quarantined', true
    );
  END IF;

  v_expected := public.email_expected_stream(p_template);
  IF v_expected IS NULL THEN
    INSERT INTO public.email_source_events AS ese (
      source_event_id, stream, template, approved, recipient_count, job_count,
      status, quarantine_reason
    ) VALUES (
      p_source_event_id, p_stream, COALESCE(p_template, ''), p_approved, 0, 0,
      'quarantined', 'unknown_template'
    )
    ON CONFLICT (source_event_id) DO UPDATE
      SET status = 'quarantined',
          quarantine_reason = 'unknown_template',
          updated_at = now();

    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'unknown_template',
      'inserted', 0,
      'quarantined', true
    );
  END IF;

  IF v_expected IS DISTINCT FROM p_stream THEN
    INSERT INTO public.email_source_events AS ese (
      source_event_id, stream, template, approved, recipient_count, job_count,
      status, quarantine_reason
    ) VALUES (
      p_source_event_id, p_stream, p_template, p_approved, 0, 0,
      'quarantined', 'stream_template_mismatch'
    )
    ON CONFLICT (source_event_id) DO UPDATE
      SET status = 'quarantined',
          quarantine_reason = 'stream_template_mismatch',
          updated_at = now();

    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'stream_template_mismatch',
      'inserted', 0,
      'quarantined', true
    );
  END IF;

  IF p_jobs IS NULL OR jsonb_typeof(p_jobs) <> 'array' THEN
    RAISE EXCEPTION 'p_jobs must be a JSON array';
  END IF;

  v_count := jsonb_array_length(p_jobs);

  IF v_count > 100 THEN
    INSERT INTO public.email_source_events AS ese (
      source_event_id, stream, template, approved, recipient_count, job_count,
      status, quarantine_reason
    ) VALUES (
      p_source_event_id, p_stream, p_template, p_approved, v_count, 0,
      'aborted', 'invocation_job_limit_exceeded'
    )
    ON CONFLICT (source_event_id) DO UPDATE
      SET status = 'aborted',
          quarantine_reason = 'invocation_job_limit_exceeded',
          recipient_count = EXCLUDED.recipient_count,
          updated_at = now();

    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'invocation_job_limit_exceeded',
      'inserted', 0,
      'aborted', true,
      'job_count', v_count
    );
  END IF;

  -- Collect unique recipients for fan-out check
  FOR v_job IN SELECT * FROM jsonb_array_elements(p_jobs)
  LOOP
    v_recipient := lower(COALESCE(v_job->>'to', v_job->'payload'->>'to', ''));
    IF v_recipient <> '' AND NOT (v_recipient = ANY (v_recipients)) THEN
      v_recipients := array_append(v_recipients, v_recipient);
    END IF;
  END LOOP;

  IF NOT p_approved AND cardinality(v_recipients) > 50 THEN
    INSERT INTO public.email_source_events AS ese (
      source_event_id, stream, template, approved, recipient_count, job_count,
      status, quarantine_reason
    ) VALUES (
      p_source_event_id, p_stream, p_template, false,
      cardinality(v_recipients), 0,
      'quarantined', 'unapproved_fanout_exceeded'
    )
    ON CONFLICT (source_event_id) DO UPDATE
      SET status = 'quarantined',
          quarantine_reason = 'unapproved_fanout_exceeded',
          recipient_count = EXCLUDED.recipient_count,
          updated_at = now();

    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'unapproved_fanout_exceeded',
      'inserted', 0,
      'quarantined', true,
      'recipient_count', cardinality(v_recipients)
    );
  END IF;

  -- Upsert open reservation (locked by PK upsert)
  INSERT INTO public.email_source_events AS ese (
    source_event_id, stream, template, approved,
    recipient_count, job_count, status
  ) VALUES (
    p_source_event_id, p_stream, p_template, p_approved,
    cardinality(v_recipients), 0, 'open'
  )
  ON CONFLICT (source_event_id) DO UPDATE
    SET updated_at = now()
  RETURNING * INTO v_event;

  IF v_event.status IN ('quarantined', 'aborted') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', COALESCE(v_event.quarantine_reason, v_event.status),
      'inserted', 0,
      'quarantined', v_event.status = 'quarantined',
      'aborted', v_event.status = 'aborted'
    );
  END IF;

  -- Validate + insert atomically (any hard failure aborts the transaction)
  FOR v_job IN SELECT * FROM jsonb_array_elements(p_jobs)
  LOOP
    v_idem := NULLIF(btrim(COALESCE(v_job->>'idempotency_key', '')), '');
    IF v_idem IS NULL THEN
      RAISE EXCEPTION 'missing idempotency key';
    END IF;

    v_payload := COALESCE(v_job->'payload', v_job - 'idempotency_key' - 'stream');
    IF v_payload->>'template' IS NULL THEN
      v_payload := jsonb_set(v_payload, '{template}', to_jsonb(p_template), true);
    END IF;
    IF v_payload->>'to' IS NULL AND v_job->>'to' IS NOT NULL THEN
      v_payload := jsonb_set(v_payload, '{to}', v_job->'to', true);
    END IF;

    v_recipient := lower(COALESCE(v_payload->>'to', ''));
    IF v_recipient = '' THEN
      RAISE EXCEPTION 'missing recipient';
    END IF;

    IF COALESCE(v_payload->>'template', '') IS DISTINCT FROM p_template THEN
      RAISE EXCEPTION 'job template mismatch';
    END IF;

    IF NOT public.email_frequency_allows(v_recipient, p_stream) THEN
      INSERT INTO public.email_frequency_suppressions (
        recipient_email, stream, template, source_event_id, reason
      ) VALUES (
        v_recipient, p_stream, p_template, p_source_event_id, 'frequency_cap'
      );
      v_suppressed := v_suppressed + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.email_jobs (stream, payload, idempotency_key)
    VALUES (p_stream, v_payload, v_idem)
    ON CONFLICT (idempotency_key) WHERE (idempotency_key IS NOT NULL)
    DO NOTHING;

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  UPDATE public.email_source_events
  SET
    job_count = v_inserted,
    recipient_count = cardinality(v_recipients),
    status = 'queued',
    updated_at = now()
  WHERE source_event_id = p_source_event_id;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'suppressed', v_suppressed,
    'recipient_count', cardinality(v_recipients),
    'source_event_id', p_source_event_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.email_jobs_enqueue_batch(text, text, text, jsonb, boolean)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_jobs_enqueue_batch(text, text, text, jsonb, boolean)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_jobs_enqueue_batch(text, text, text, jsonb, boolean)
  TO service_role;
