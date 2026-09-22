-- Regression suite for the Hot Sheet "status changes only" rule.
--
-- Guards the September 2026 regression where a same-status edit (50 Proctor
-- Avenue, off_market -> off_market) produced a Hot Sheet event and a wrong
-- "New Match" email.
--
-- Runs in one transaction that is ROLLED BACK, inside a disposable cluster.
-- net.http_post is the recording stub; no HTTP request and no email-provider
-- call is possible.
BEGIN;

CREATE TEMP TABLE t(k text PRIMARY KEY, v uuid);

INSERT INTO public.counties(name, state) VALUES ('Suffolk','MA');

INSERT INTO public.listings(status, state, county, city, neighborhood, property_type,
                            price, bedrooms, bathrooms, square_feet, agent_id)
VALUES ('draft','MA','Suffolk','Boston','South Boston','single_family',
        500000, 3, 2, 2000, gen_random_uuid());
INSERT INTO t VALUES ('draft_listing', (SELECT id FROM public.listings LIMIT 1));

DO $outer$
DECLARE
  v_draft   uuid := (SELECT v FROM t WHERE k='draft_listing');
  v_live    uuid;
  v_n       bigint;
  v_events  bigint;
BEGIN
  ---------------------------------------------------------------------------
  -- 1. A draft INSERT is not a deliverable status: no event at all.
  ---------------------------------------------------------------------------
  ASSERT (SELECT count(*) FROM public.hot_sheet_listing_events WHERE listing_id=v_draft) = 0,
    'a draft insert must not create a Hot Sheet event';

  ---------------------------------------------------------------------------
  -- 2. draft -> first live status is the real publication: exactly one event,
  --    old_status recorded as draft (downstream classifies it as New Match).
  ---------------------------------------------------------------------------
  UPDATE public.listings SET status='coming_soon', updated_at=now() WHERE id=v_draft;
  SELECT count(*) INTO v_n FROM public.hot_sheet_listing_events WHERE listing_id=v_draft;
  ASSERT v_n = 1, format('publication must create exactly 1 event, got %s', v_n);
  ASSERT (SELECT old_status FROM public.hot_sheet_listing_events WHERE listing_id=v_draft) = 'draft',
    'publication event must record draft as the previous status';

  ---------------------------------------------------------------------------
  -- 3. Same-status UPDATE (property-field edit) creates NOTHING.
  ---------------------------------------------------------------------------
  UPDATE public.listings
     SET bedrooms = 4, updated_at = now() + interval '1 second'
   WHERE id = v_draft;
  ASSERT (SELECT count(*) FROM public.hot_sheet_listing_events WHERE listing_id=v_draft) = 1,
    'a beds-only edit must not create a Hot Sheet event';

  -- Price-only edit at an unchanged status: still nothing.
  UPDATE public.listings
     SET price = 475000, updated_at = now() + interval '2 seconds'
   WHERE id = v_draft;
  ASSERT (SELECT count(*) FROM public.hot_sheet_listing_events WHERE listing_id=v_draft) = 1,
    'a price-only edit must not create a Hot Sheet event';

  -- Explicit same-status write (status assigned to its current value).
  UPDATE public.listings
     SET status = 'coming_soon', updated_at = now() + interval '3 seconds'
   WHERE id = v_draft;
  ASSERT (SELECT count(*) FROM public.hot_sheet_listing_events WHERE listing_id=v_draft) = 1,
    'a same-status write must not create a Hot Sheet event';

  ---------------------------------------------------------------------------
  -- 4. The 50 Proctor fingerprint: off_market -> off_market sends nothing.
  ---------------------------------------------------------------------------
  INSERT INTO public.listings(status, state, county, city, property_type, price,
                              bedrooms, bathrooms, square_feet, agent_id)
  VALUES ('off_market','MA','Suffolk','Boston','single_family', 800000, 4, 3, 2600,
          gen_random_uuid())
  RETURNING id INTO v_live;

  SELECT count(*) INTO v_events FROM public.hot_sheet_listing_events WHERE listing_id=v_live;
  ASSERT v_events = 1, format('insert in a deliverable status creates one event, got %s', v_events);

  UPDATE public.listings
     SET status = 'off_market', price = 790000, updated_at = now() + interval '4 seconds'
   WHERE id = v_live;
  ASSERT (SELECT count(*) FROM public.hot_sheet_listing_events WHERE listing_id=v_live) = 1,
    'off_market -> off_market must create no additional event';

  ---------------------------------------------------------------------------
  -- 5. Genuine transitions still create exactly one event each, with both
  --    statuses recorded so the matcher can pick status-specific copy.
  ---------------------------------------------------------------------------
  UPDATE public.listings SET status='active', updated_at=now()+interval '5 seconds'
   WHERE id=v_live;
  ASSERT (SELECT count(*) FROM public.hot_sheet_listing_events
           WHERE listing_id=v_live AND old_status='off_market' AND new_status='active') = 1,
    'off_market -> active must create one status-change event';

  UPDATE public.listings SET status='off_market', updated_at=now()+interval '6 seconds'
   WHERE id=v_live;
  ASSERT (SELECT count(*) FROM public.hot_sheet_listing_events
           WHERE listing_id=v_live AND old_status='active' AND new_status='off_market') = 1,
    'active -> off_market must create one status-change event';

  ---------------------------------------------------------------------------
  -- 6. The legacy pg_net kick is gone: delivery is outbox-only, so no
  --    event-less HTTP dispatch may be issued by the trigger.
  ---------------------------------------------------------------------------
  ASSERT (SELECT count(*) FROM net.sent_requests) = 0,
    'the trigger must not issue any pg_net dispatch';

  ---------------------------------------------------------------------------
  -- 7. Isolation: the harness writes no send evidence and no email jobs.
  ---------------------------------------------------------------------------
  ASSERT (SELECT count(*) FROM public.hot_sheet_sent_listings) = 0,
    'no send evidence may be written by this harness';
  ASSERT (SELECT count(*) FROM public.email_jobs) = 0,
    'no email job may be created by this harness';

  RAISE NOTICE 'ALL STATUS-ONLY TRIGGER ASSERTIONS PASSED';
END $outer$;

ROLLBACK;
