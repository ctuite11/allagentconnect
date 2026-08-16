-- Zero-email behavioural verification of the durable Hot Sheet outbox.
-- Runs entirely inside one transaction that is ROLLED BACK at the end, in a
-- disposable Postgres cluster. net.http_post is the recording stub, so no HTTP
-- request and no email-provider call is possible.
BEGIN;

CREATE TEMP TABLE t(k text PRIMARY KEY, v uuid);

INSERT INTO public.counties(name, state) VALUES ('Suffolk','MA');

INSERT INTO public.listings(status, state, county, city, neighborhood, property_type,
                            price, bedrooms, bathrooms, square_feet, agent_id)
VALUES ('draft','MA','Suffolk','Boston','South Boston','single_family',
        500000, 3, 2, 2000, gen_random_uuid());
INSERT INTO t VALUES ('listing', (SELECT id FROM public.listings LIMIT 1));

INSERT INTO public.hot_sheets(name, criteria, is_active)
VALUES ('Boston SF', '{"cities":["Boston"]}'::jsonb, true);
INSERT INTO t VALUES ('hs', (SELECT id FROM public.hot_sheets LIMIT 1));

DO $outer$
DECLARE
  v_listing uuid := (SELECT v FROM t WHERE k='listing');
  v_hs      uuid := (SELECT v FROM t WHERE k='hs');
  v_event   uuid;
  v_event2  uuid;
  v_n       bigint;
  v_state   text;
  v_res     jsonb;
  v_ok      boolean;
  v_next    timestamptz;
  v_attempts int;
BEGIN
  ---------------------------------------------------------------------------
  -- 1. DURABILITY: a qualifying status change writes exactly one outbox event
  ---------------------------------------------------------------------------
  UPDATE public.listings SET status='coming_soon', updated_at=now() WHERE id=v_listing;

  SELECT count(*) INTO v_n FROM public.hot_sheet_listing_events WHERE listing_id=v_listing;
  ASSERT v_n = 1, format('expected 1 outbox event, got %s', v_n);

  SELECT id, state INTO v_event, v_state
    FROM public.hot_sheet_listing_events WHERE listing_id=v_listing;
  ASSERT v_state = 'pending', 'new event must be pending';
  ASSERT (SELECT new_status FROM public.hot_sheet_listing_events WHERE id=v_event) = 'coming_soon',
    'event must record the resulting status';
  ASSERT (SELECT old_status FROM public.hot_sheet_listing_events WHERE id=v_event) = 'draft',
    'event must record the previous status';
  ASSERT (SELECT dedupe_key IS NOT NULL FROM public.hot_sheet_listing_events WHERE id=v_event),
    'event must carry an ingest dedupe key';

  -- breadcrumb + best-effort legacy kick both happened
  ASSERT (SELECT count(*) FROM public.hot_sheet_event_stage_log WHERE event_id=v_event) >= 1,
    'stage log breadcrumb expected';
  ASSERT (SELECT count(*) FROM net.sent_requests) = 1,
    'exactly one recorded (stubbed) legacy kick expected';

  -- non-qualifying edit creates no obligation
  UPDATE public.listings SET updated_at = now() + interval '1 second' WHERE id=v_listing;
  ASSERT (SELECT count(*) FROM public.hot_sheet_listing_events WHERE listing_id=v_listing) = 1,
    'non-qualifying field change must not create an outbox event';

  ---------------------------------------------------------------------------
  -- 2. ATOMICITY: a failing outbox insert aborts the listing change
  ---------------------------------------------------------------------------
  CREATE FUNCTION pg_temp.boom() RETURNS trigger LANGUAGE plpgsql AS
    $b$ BEGIN RAISE EXCEPTION 'forced outbox failure'; END; $b$;
  CREATE TRIGGER force_outbox_failure BEFORE INSERT ON public.hot_sheet_listing_events
    FOR EACH ROW EXECUTE FUNCTION pg_temp.boom();

  BEGIN
    UPDATE public.listings SET status='active', updated_at=now()+interval '2 seconds'
     WHERE id=v_listing;
    ASSERT false, 'listing change must fail when the outbox insert fails';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  ASSERT (SELECT status FROM public.listings WHERE id=v_listing) = 'coming_soon',
    'listing status must be rolled back when the obligation cannot be recorded';
  ASSERT (SELECT count(*) FROM public.hot_sheet_listing_events WHERE listing_id=v_listing) = 1,
    'no partial event may survive the aborted change';

  DROP TRIGGER force_outbox_failure ON public.hot_sheet_listing_events;

  ---------------------------------------------------------------------------
  -- 3. NON-FATAL: stage-log and pg_net failures never abort the save
  ---------------------------------------------------------------------------
  CREATE OR REPLACE FUNCTION public.log_hot_sheet_event_stage(
    p_event_id uuid, p_listing_id uuid, p_stage text, p_outcome text, p_detail jsonb DEFAULT '{}'::jsonb
  ) RETURNS void LANGUAGE plpgsql AS $l$ BEGIN RAISE EXCEPTION 'forced stage log failure'; END; $l$;

  CREATE OR REPLACE FUNCTION net.http_post(url text, headers jsonb DEFAULT '{}', body jsonb DEFAULT '{}')
  RETURNS bigint LANGUAGE plpgsql AS $h$ BEGIN RAISE EXCEPTION 'forced transport failure'; END; $h$;

  UPDATE public.listings SET status='active', updated_at=now()+interval '3 seconds'
   WHERE id=v_listing;

  ASSERT (SELECT status FROM public.listings WHERE id=v_listing) = 'active',
    'listing save must survive best-effort failures';
  ASSERT (SELECT count(*) FROM public.hot_sheet_listing_events WHERE listing_id=v_listing) = 2,
    'outbox event must still be recorded when logging/transport fail';

  SELECT id INTO v_event2 FROM public.hot_sheet_listing_events
   WHERE listing_id=v_listing AND new_status='active';

  ---------------------------------------------------------------------------
  -- 4. MATCHER: the fixture hot sheet is a genuine target for this listing
  ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n FROM public.check_hot_sheet_matches(v_hs);
  ASSERT v_n = 1, format('matcher should return the fixture listing, got %s', v_n);

  ---------------------------------------------------------------------------
  -- 5. PAUSED delivery -> paused_held claim, zero email jobs
  ---------------------------------------------------------------------------
  v_res := public.enqueue_hot_sheet_delivery(
    v_event, v_listing, 'coming_soon', v_hs, 'agent', 'Agent@Example.com',
    jsonb_build_object('template','new-match-notification'),
    'hs-agent:'||v_hs||':'||v_listing||':coming_soon',
    true, 'hot_sheet_emails_paused');
  ASSERT v_res->>'result' = 'paused_held', format('expected paused_held, got %s', v_res::text);
  ASSERT (SELECT state FROM public.hot_sheet_delivery_claims WHERE id=(v_res->>'claim_id')::uuid) = 'paused_held',
    'claim must be recorded as paused_held';
  ASSERT (SELECT count(*) FROM public.email_jobs) = 0, 'paused delivery must create no email job';

  -- duplicate while paused: no second claim, still no job
  v_res := public.enqueue_hot_sheet_delivery(
    v_event2, v_listing, 'coming_soon', v_hs, 'agent', 'agent@example.com',
    '{}'::jsonb, 'hs-agent:dup', true, 'hot_sheet_emails_paused');
  ASSERT v_res->>'result' = 'duplicate', 'second event for the same logical delivery must be a duplicate';
  ASSERT (SELECT count(*) FROM public.hot_sheet_delivery_claims) = 1, 'only one logical claim may exist';
  ASSERT (SELECT count(*) FROM public.email_jobs) = 0, 'duplicate must create no email job';

  ---------------------------------------------------------------------------
  -- 6. UNPAUSED simulation (disposable cluster only): claim + job atomically
  ---------------------------------------------------------------------------
  v_res := public.enqueue_hot_sheet_delivery(
    v_event2, v_listing, 'active', v_hs, 'agent', 'agent@example.com',
    jsonb_build_object('template','new-match-notification'),
    'hs-agent:active:1', false, NULL);
  ASSERT v_res->>'result' = 'enqueued', format('expected enqueued, got %s', v_res::text);
  ASSERT (SELECT count(*) FROM public.email_jobs) = 1, 'exactly one job for one enqueued claim';
  ASSERT (SELECT email_job_id FROM public.hot_sheet_delivery_claims WHERE id=(v_res->>'claim_id')::uuid)
         = (SELECT id FROM public.email_jobs), 'claim must point at its job';
  ASSERT NOT EXISTS (SELECT 1 FROM public.hot_sheet_delivery_claims
                      WHERE state='enqueued' AND email_job_id IS NULL),
    'no enqueued claim may exist without a job';

  -- duplicate invocation of the same logical delivery: no second job
  v_res := public.enqueue_hot_sheet_delivery(
    v_event, v_listing, 'active', v_hs, 'agent', 'AGENT@example.com',
    '{}'::jsonb, 'hs-agent:active:2', false, NULL);
  ASSERT v_res->>'result' = 'duplicate', 'repeat delivery must be a duplicate';
  ASSERT (SELECT count(*) FROM public.email_jobs) = 1, 'duplicate must not create a second job';

  ---------------------------------------------------------------------------
  -- 7. Forced email-job insert failure: neither claim nor job survives
  ---------------------------------------------------------------------------
  CREATE TRIGGER force_job_failure BEFORE INSERT ON public.email_jobs
    FOR EACH ROW EXECUTE FUNCTION pg_temp.boom();

  BEGIN
    PERFORM public.enqueue_hot_sheet_delivery(
      v_event2, v_listing, 'active', v_hs, 'client', 'buyer@example.com',
      '{}'::jsonb, 'hs-client:active:1', false, NULL);
    ASSERT false, 'enqueue must fail when the job insert fails';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  DROP TRIGGER force_job_failure ON public.email_jobs;

  ASSERT NOT EXISTS (SELECT 1 FROM public.hot_sheet_delivery_claims WHERE audience='client'),
    'aborted delivery must leave no claim';
  ASSERT (SELECT count(*) FROM public.email_jobs) = 1, 'aborted delivery must leave no job';

  -- retry after the fault clears succeeds cleanly
  v_res := public.enqueue_hot_sheet_delivery(
    v_event2, v_listing, 'active', v_hs, 'client', 'buyer@example.com',
    '{}'::jsonb, 'hs-client:active:1', false, NULL);
  ASSERT v_res->>'result' = 'enqueued', 'retry after a transient fault must succeed';
  ASSERT (SELECT count(*) FROM public.email_jobs) = 2, 'retry creates exactly one further job';

  ---------------------------------------------------------------------------
  -- 8. LEASES: reclaim after expiry, and fencing of the zombie worker
  ---------------------------------------------------------------------------
  SELECT count(*) INTO v_n FROM public.claim_hot_sheet_events(10, 'worker-a', 300);
  ASSERT v_n = 2, format('worker-a should claim both pending events, got %s', v_n);
  ASSERT (SELECT claimed_by FROM public.hot_sheet_listing_events WHERE id=v_event) = 'worker-a',
    'event must be owned by worker-a';
  ASSERT (SELECT attempts FROM public.hot_sheet_listing_events WHERE id=v_event) = 1,
    'attempts increments on claim';

  -- a non-owner cannot complete a live lease
  ASSERT public.complete_hot_sheet_event(v_event, 'worker-b') = false,
    'a worker without the lease must not complete the event';

  -- worker-a dies; lease expires
  UPDATE public.hot_sheet_listing_events
     SET lease_expires_at = now() - interval '1 minute' WHERE id = v_event;

  SELECT count(*) INTO v_n FROM public.claim_hot_sheet_events(10, 'worker-b', 300);
  ASSERT v_n = 1, format('worker-b should reclaim exactly the stale event, got %s', v_n);
  ASSERT (SELECT claimed_by FROM public.hot_sheet_listing_events WHERE id=v_event) = 'worker-b',
    'stale event must be reclaimed by worker-b';
  ASSERT (SELECT attempts FROM public.hot_sheet_listing_events WHERE id=v_event) = 2,
    'reclaim increments attempts';

  -- zombie worker-a wakes up late: fenced out of BOTH terminal writes
  ASSERT public.complete_hot_sheet_event(v_event, 'worker-a') = false,
    'expired worker must not be able to complete the event';
  ASSERT public.fail_hot_sheet_event(v_event, 'worker-a', 'zombie') = false,
    'expired worker must not be able to fail the event';
  ASSERT (SELECT state FROM public.hot_sheet_listing_events WHERE id=v_event) = 'claimed',
    'zombie writes must not change state';
  ASSERT (SELECT claimed_by FROM public.hot_sheet_listing_events WHERE id=v_event) = 'worker-b',
    'zombie writes must not steal ownership';
  ASSERT (SELECT count(*) FROM public.hot_sheet_delivery_claims) = 2,
    'lease churn must not create duplicate delivery claims';

  -- current owner can complete
  ASSERT public.complete_hot_sheet_event(v_event, 'worker-b') = true,
    'the lease holder must be able to complete the event';
  ASSERT (SELECT state FROM public.hot_sheet_listing_events WHERE id=v_event) = 'processed',
    'completed event must be processed';

  ---------------------------------------------------------------------------
  -- 9. FAILURE durability + safe retry
  ---------------------------------------------------------------------------
  ASSERT public.fail_hot_sheet_event(v_event2, 'worker-a', 'matcher exploded') = true,
    'the lease holder must be able to fail the event';
  SELECT state, attempts, next_attempt_at INTO v_state, v_attempts, v_next
    FROM public.hot_sheet_listing_events WHERE id=v_event2;
  ASSERT v_state = 'failed', 'failed event must persist as failed';
  ASSERT v_attempts = 1, 'attempts persists across failure';
  ASSERT v_next > now(), 'failure must schedule a future backoff retry';
  ASSERT (SELECT last_error FROM public.hot_sheet_listing_events WHERE id=v_event2) = 'matcher exploded',
    'failure reason must be durable';

  -- not eligible until the backoff elapses
  SELECT count(*) INTO v_n FROM public.claim_hot_sheet_events(10, 'worker-c', 300);
  ASSERT v_n = 0, 'a backed-off event must not be reclaimed early';

  UPDATE public.hot_sheet_listing_events SET next_attempt_at = now() - interval '1 second'
   WHERE id = v_event2;
  SELECT count(*) INTO v_n FROM public.claim_hot_sheet_events(10, 'worker-c', 300);
  ASSERT v_n = 1, 'a failed event must be retried once its backoff elapses';
  ASSERT (SELECT attempts FROM public.hot_sheet_listing_events WHERE id=v_event2) = 2,
    'retry increments attempts';
  ASSERT (SELECT count(*) FROM public.hot_sheet_delivery_claims) = 2,
    'retry must not duplicate delivery claims';

  ---------------------------------------------------------------------------
  -- 10. ISOLATION
  ---------------------------------------------------------------------------
  ASSERT (SELECT count(*) FROM public.hot_sheet_sent_listings) = 0,
    'no send evidence may be written by this harness';

  RAISE NOTICE 'ALL OUTBOX BEHAVIOUR ASSERTIONS PASSED';
END $outer$;

ROLLBACK;
