-- Hot Sheet delivery hardening — Migration B: worker + atomic delivery RPCs (inert)

CREATE OR REPLACE FUNCTION public.log_hot_sheet_event_stage(
  p_event_id uuid,
  p_listing_id uuid,
  p_stage text,
  p_outcome text,
  p_detail jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_service_role();
  INSERT INTO public.hot_sheet_event_stage_log (event_id, listing_id, stage, outcome, detail)
  VALUES (p_event_id, p_listing_id, p_stage, p_outcome, COALESCE(p_detail, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_hot_sheet_events(
  p_limit integer DEFAULT 10,
  p_worker_id text DEFAULT 'unknown',
  p_lease_seconds integer DEFAULT 300
) RETURNS SETOF public.hot_sheet_listing_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_service_role();

  RETURN QUERY
  UPDATE public.hot_sheet_listing_events e
     SET state = 'claimed',
         claimed_at = now(),
         claimed_by = p_worker_id,
         lease_expires_at = now() + make_interval(secs => GREATEST(p_lease_seconds, 30)),
         attempts = e.attempts + 1
   WHERE e.id IN (
     SELECT c.id
       FROM public.hot_sheet_listing_events c
      WHERE (c.state = 'pending' AND COALESCE(c.next_attempt_at, now()) <= now())
         OR (c.state = 'claimed' AND c.lease_expires_at IS NOT NULL AND c.lease_expires_at < now())
         OR (c.state = 'failed' AND c.next_attempt_at IS NOT NULL AND c.next_attempt_at <= now() AND c.attempts < 8)
      ORDER BY c.created_at
      LIMIT GREATEST(COALESCE(p_limit, 10), 1)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING e.*;
END;
$$;

-- Atomic logical delivery: claim + email job in ONE transaction.
-- Pause state is supplied by the caller (the Edge Function stream gate reads the
-- env switches) and is applied inside this transaction, so a claim can never be
-- committed as 'enqueued' without its email_jobs row.
CREATE OR REPLACE FUNCTION public.enqueue_hot_sheet_delivery(
  p_event_id uuid,
  p_listing_id uuid,
  p_status text,
  p_hot_sheet_id uuid,
  p_audience text,
  p_recipient_key text,
  p_payload jsonb,
  p_idempotency_key text,
  p_paused boolean DEFAULT true,
  p_pause_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim_id uuid;
  v_job_id uuid;
BEGIN
  PERFORM public.assert_service_role();

  IF p_recipient_key IS NULL OR btrim(p_recipient_key) = '' THEN
    RAISE EXCEPTION 'recipient_key is required';
  END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  INSERT INTO public.hot_sheet_delivery_claims (
    listing_id, status_at_send, hot_sheet_id, audience, recipient_key, event_id, state, reason
  ) VALUES (
    p_listing_id, p_status, p_hot_sheet_id, p_audience, lower(btrim(p_recipient_key)),
    p_event_id, 'skipped', 'claiming'
  )
  ON CONFLICT (listing_id, status_at_send, hot_sheet_id, audience, recipient_key) DO NOTHING
  RETURNING id INTO v_claim_id;

  IF v_claim_id IS NULL THEN
    RETURN jsonb_build_object('result', 'duplicate');
  END IF;

  IF COALESCE(p_paused, true) THEN
    UPDATE public.hot_sheet_delivery_claims
       SET state = 'paused_held',
           reason = COALESCE(p_pause_reason, 'hot_sheet_emails_paused')
     WHERE id = v_claim_id;
    RETURN jsonb_build_object('result', 'paused_held', 'claim_id', v_claim_id);
  END IF;

  INSERT INTO public.email_jobs (payload, stream, idempotency_key)
  VALUES (p_payload, 'hot_sheet', p_idempotency_key)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_job_id;

  IF v_job_id IS NULL THEN
    SELECT id INTO v_job_id
      FROM public.email_jobs
     WHERE idempotency_key = p_idempotency_key
     LIMIT 1;
  END IF;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'failed to resolve email job for idempotency_key %', p_idempotency_key;
  END IF;

  UPDATE public.hot_sheet_delivery_claims
     SET state = 'enqueued', email_job_id = v_job_id, reason = NULL
   WHERE id = v_claim_id;

  RETURN jsonb_build_object('result', 'enqueued', 'claim_id', v_claim_id, 'email_job_id', v_job_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_hot_sheet_event(
  p_event_id uuid,
  p_worker_id text,
  p_state text DEFAULT 'processed'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  PERFORM public.assert_service_role();

  IF p_state NOT IN ('processed', 'paused_held', 'skipped') THEN
    RAISE EXCEPTION 'invalid terminal state %', p_state;
  END IF;

  UPDATE public.hot_sheet_listing_events
     SET state = p_state,
         last_error = NULL,
         next_attempt_at = NULL,
         lease_expires_at = NULL
   WHERE id = p_event_id
     AND claimed_by = p_worker_id
     AND lease_expires_at IS NOT NULL
     AND lease_expires_at > now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_hot_sheet_event(
  p_event_id uuid,
  p_worker_id text,
  p_error text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  PERFORM public.assert_service_role();

  UPDATE public.hot_sheet_listing_events e
     SET state = 'failed',
         last_error = left(COALESCE(p_error, 'unknown error'), 2000),
         lease_expires_at = NULL,
         next_attempt_at = now() + LEAST(
           make_interval(secs => 60 * power(2, LEAST(e.attempts, 6))::int),
           interval '1 hour'
         )
   WHERE e.id = p_event_id
     AND e.claimed_by = p_worker_id
     AND e.lease_expires_at IS NOT NULL
     AND e.lease_expires_at > now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_hot_sheet_event_stage(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_hot_sheet_events(integer, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_hot_sheet_delivery(uuid, uuid, text, uuid, text, text, jsonb, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_hot_sheet_event(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_hot_sheet_event(uuid, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.log_hot_sheet_event_stage(uuid, uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_hot_sheet_events(integer, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_hot_sheet_delivery(uuid, uuid, text, uuid, text, text, jsonb, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_hot_sheet_event(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_hot_sheet_event(uuid, text, text) TO service_role;