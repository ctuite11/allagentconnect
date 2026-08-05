-- Behavioural tests for public.check_hot_sheet_matches and the Hot Sheet
-- listing-event trigger. Everything runs inside one transaction that is rolled
-- back at the end; net.http_post is the recording stub from 00_fixture.sql, so
-- no HTTP request and no email provider call can occur.
BEGIN;

CREATE TEMP TABLE t_ids(k text PRIMARY KEY, v uuid);

INSERT INTO public.counties(name, state) VALUES ('Suffolk', 'MA');
INSERT INTO t_ids VALUES ('county', (SELECT id FROM public.counties WHERE name='Suffolk'));

INSERT INTO public.listings(status, state, county, city, neighborhood, property_type, price,
                            bedrooms, bathrooms, lot_size, square_feet,
                            parking_spaces, garage_spaces, total_parking_spaces, agent_id)
VALUES ('active','MA','Suffolk','Boston','South Boston','single_family', 500000,
        3, 2, 0.25, 2000, 1, 1, 2, gen_random_uuid());

INSERT INTO t_ids VALUES ('listing', (SELECT id FROM public.listings LIMIT 1));

-- match(criteria) -> number of listings the matcher returns for that criteria.
CREATE FUNCTION pg_temp.match(p_criteria jsonb) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_id uuid; v_n bigint;
BEGIN
  INSERT INTO public.hot_sheets(name, criteria, is_active)
  VALUES ('t', p_criteria, true) RETURNING id INTO v_id;
  SELECT count(*) INTO v_n FROM public.check_hot_sheet_matches(v_id);
  DELETE FROM public.hot_sheets WHERE id = v_id;
  RETURN v_n;
END; $$;

DO $$
DECLARE c uuid := (SELECT v FROM t_ids WHERE k='county');
BEGIN
  -- ---- omitted criteria remain unrestricted -------------------------------
  ASSERT pg_temp.match('{}'::jsonb) = 1, 'empty criteria should match the active listing';

  -- ---- every supported criterion excludes a deliberate non-match ----------
  ASSERT pg_temp.match('{"state":"NH"}') = 0, 'state must exclude';
  ASSERT pg_temp.match('{"state":"ma"}') = 1, 'state compare is case-insensitive';
  ASSERT pg_temp.match(jsonb_build_object('selectedCountyId', c::text)) = 1, 'known county matches';
  ASSERT pg_temp.match('{"county":"Norfolk"}') = 0, 'county name must exclude';
  ASSERT pg_temp.match('{"cities":["Newton"]}') = 0, 'cities must exclude';
  ASSERT pg_temp.match('{"cities":["Boston"]}') = 1, 'city matches';
  ASSERT pg_temp.match('{"cities":["South Boston"],"showAreas":true}') = 1, 'neighborhood matches when showAreas';
  ASSERT pg_temp.match('{"cities":["South Boston"],"showAreas":false}') = 0, 'neighborhood excluded when showAreas false';
  ASSERT pg_temp.match('{"propertyTypes":["condo"]}') = 0, 'propertyTypes must exclude';
  ASSERT pg_temp.match('{"statuses":["sold"]}') = 0, 'statuses must exclude';
  ASSERT pg_temp.match('{"minPrice":"600000"}') = 0, 'minPrice must exclude';
  ASSERT pg_temp.match('{"maxPrice":"400000"}') = 0, 'maxPrice must exclude';
  ASSERT pg_temp.match('{"minPrice":"600000","hasNoMin":"true"}') = 1, 'hasNoMin disables minPrice';
  ASSERT pg_temp.match('{"maxPrice":"400000","hasNoMax":"true"}') = 1, 'hasNoMax disables maxPrice';
  ASSERT pg_temp.match('{"bedrooms":"4"}') = 0, 'bedrooms must exclude';
  ASSERT pg_temp.match('{"bathrooms":"3"}') = 0, 'bathrooms must exclude';
  ASSERT pg_temp.match('{"acres":"1.5"}') = 0, 'acres must exclude';
  ASSERT pg_temp.match('{"minSqft":"3000"}') = 0, 'minSqft must exclude';
  ASSERT pg_temp.match('{"maxSqft":"1000"}') = 0, 'maxSqft must exclude';
  ASSERT pg_temp.match('{"pricePerSqft":"100"}') = 0, 'pricePerSqft must exclude';
  ASSERT pg_temp.match('{"pricePerSqft":"500"}') = 1, 'pricePerSqft passes when under cap';
  ASSERT pg_temp.match('{"hasParking":"no"}') = 0, 'hasParking=no excludes a listing with parking';
  ASSERT pg_temp.match('{"hasParking":"yes"}') = 1, 'hasParking=yes matches a listing with parking';
  ASSERT pg_temp.match('{"hasParking":"any"}') = 1, 'hasParking=any is unrestricted';

  -- ---- legacy empty-string values must not throw --------------------------
  ASSERT pg_temp.match('{"state":"","county":"","minPrice":"","maxPrice":"","bedrooms":"",
    "bathrooms":"","acres":"","minSqft":"","maxSqft":"","pricePerSqft":"","hasParking":"",
    "hasNoMin":"","hasNoMax":"","showAreas":"","statuses":null,"cities":null,
    "propertyTypes":null,"rooms":""}'::jsonb) = 1,
    'legacy empty-string criteria must be ignored, not raise';
  ASSERT pg_temp.match('{"statuses":"active","cities":"Boston","propertyTypes":"condo"}') = 1,
    'non-array list criteria are ignored rather than crashing';

  -- ---- unresolvable county fails closed -----------------------------------
  ASSERT pg_temp.match('{"selectedCountyId":"00000000-0000-4000-8000-000000000000"}') = 0,
    'unknown county UUID must return zero matches, not drop the filter';

  -- ---- rooms fails closed until a real column exists ----------------------
  ASSERT pg_temp.match('{"rooms":"6"}') = 0, 'rooms criterion must return zero matches';

  -- ---- inactive hot sheets never match ------------------------------------
  ASSERT (SELECT count(*) FROM public.check_hot_sheet_matches(gen_random_uuid())) = 0,
    'unknown hot sheet returns nothing';
END $$;

-- ---- unknown parking data is not proof of "no parking" --------------------
UPDATE public.listings
   SET parking_spaces = NULL, garage_spaces = NULL, total_parking_spaces = NULL;

DO $$
BEGIN
  ASSERT pg_temp.match('{"hasParking":"no"}') = 0,
    'all-NULL parking must NOT satisfy hasParking=no';
  ASSERT pg_temp.match('{"hasParking":"yes"}') = 0,
    'all-NULL parking must NOT satisfy hasParking=yes';
END $$;

UPDATE public.listings SET parking_spaces = 0, garage_spaces = 0, total_parking_spaces = 0;
DO $$
BEGIN
  ASSERT pg_temp.match('{"hasParking":"no"}') = 1,
    'explicit zero parking satisfies hasParking=no';
END $$;

-- ---- per-status sent-state dedupe ------------------------------------------
DO $$
DECLARE v_hs uuid;
BEGIN
  INSERT INTO public.hot_sheets(name, criteria, is_active) VALUES ('dedupe','{}'::jsonb,true)
  RETURNING id INTO v_hs;
  ASSERT (SELECT count(*) FROM public.check_hot_sheet_matches(v_hs)) = 1, 'first pass matches';
  INSERT INTO public.hot_sheet_sent_listings(hot_sheet_id, listing_id, status_at_send)
  SELECT v_hs, id, status FROM public.listings;
  ASSERT (SELECT count(*) FROM public.check_hot_sheet_matches(v_hs)) = 0, 'already-sent status is suppressed';
  UPDATE public.listings SET status = 'off_market';
  ASSERT (SELECT count(*) FROM public.check_hot_sheet_matches(v_hs)) = 1, 'new status re-qualifies';
  UPDATE public.listings SET status = 'active';
  DELETE FROM public.hot_sheets WHERE id = v_hs;
END $$;

-- ============================ TRIGGER COVERAGE ==============================
CREATE FUNCTION pg_temp.dispatch_count() RETURNS bigint LANGUAGE sql AS
$$ SELECT count(*) FROM net.sent_requests $$;

DO $$
DECLARE v_id uuid := (SELECT v FROM t_ids WHERE k='listing'); n bigint;
BEGIN
  -- price change, status unchanged
  n := pg_temp.dispatch_count();
  UPDATE public.listings SET price = 480000 WHERE id = v_id;
  ASSERT pg_temp.dispatch_count() = n + 1, 'price change must dispatch';

  n := pg_temp.dispatch_count();
  UPDATE public.listings SET city = 'Newton', county = 'Middlesex' WHERE id = v_id;
  ASSERT pg_temp.dispatch_count() = n + 1, 'location change must dispatch';

  n := pg_temp.dispatch_count();
  UPDATE public.listings SET property_type = 'condo' WHERE id = v_id;
  ASSERT pg_temp.dispatch_count() = n + 1, 'property type change must dispatch';

  n := pg_temp.dispatch_count();
  UPDATE public.listings SET bedrooms = 4, bathrooms = 3 WHERE id = v_id;
  ASSERT pg_temp.dispatch_count() = n + 1, 'bed/bath change must dispatch';

  n := pg_temp.dispatch_count();
  UPDATE public.listings SET square_feet = 2400, lot_size = 0.5 WHERE id = v_id;
  ASSERT pg_temp.dispatch_count() = n + 1, 'size change must dispatch';

  n := pg_temp.dispatch_count();
  UPDATE public.listings SET total_parking_spaces = 3 WHERE id = v_id;
  ASSERT pg_temp.dispatch_count() = n + 1, 'parking change must dispatch';

  n := pg_temp.dispatch_count();
  UPDATE public.listings SET agent_id = gen_random_uuid() WHERE id = v_id;
  ASSERT pg_temp.dispatch_count() = n + 1, 'agent_id change must dispatch';

  n := pg_temp.dispatch_count();
  UPDATE public.listings SET status = 'cancelled' WHERE id = v_id;
  ASSERT pg_temp.dispatch_count() = n + 1, 'legacy cancelled spelling must dispatch';
  UPDATE public.listings SET status = 'active' WHERE id = v_id;

  -- unrelated edits must NOT dispatch
  n := pg_temp.dispatch_count();
  UPDATE public.listings SET updated_at = now() WHERE id = v_id;
  ASSERT pg_temp.dispatch_count() = n, 'updated_at touch must not dispatch';

  n := pg_temp.dispatch_count();
  UPDATE public.listings SET price = price WHERE id = v_id;
  ASSERT pg_temp.dispatch_count() = n, 'no-op write to a relevant column must not dispatch';

  -- draft / non-subscribable status must not dispatch
  n := pg_temp.dispatch_count();
  UPDATE public.listings SET status = 'draft' WHERE id = v_id;
  ASSERT pg_temp.dispatch_count() = n, 'draft status must not dispatch';
  UPDATE public.listings SET status = 'active' WHERE id = v_id;

  -- dispatcher carries exact service-role Authorization, apikey and listing_id
  ASSERT (SELECT headers->>'Authorization' FROM net.sent_requests ORDER BY id DESC LIMIT 1)
         = 'Bearer test-service-role-key', 'Authorization header must be the service-role bearer';
  ASSERT (SELECT headers->>'apikey' FROM net.sent_requests ORDER BY id DESC LIMIT 1)
         = 'test-service-role-key', 'apikey header must be the service-role key';
  ASSERT (SELECT body->>'listing_id' FROM net.sent_requests ORDER BY id DESC LIMIT 1)
         = v_id::text, 'body must carry the exact listing id';
  ASSERT (SELECT url FROM net.sent_requests ORDER BY id DESC LIMIT 1)
         LIKE '%/functions/v1/notify-matching-buyers', 'dispatch targets notify-matching-buyers only';
  ASSERT NOT EXISTS (SELECT 1 FROM net.sent_requests WHERE url LIKE '%process-comms-digests%'
                        OR url LIKE '%notify-agents-new-listing%'),
         'no Communications fan-out may be dispatched';
END $$;

-- missing vault secret => no request at all (fail closed)
DO $$
DECLARE v_id uuid := (SELECT v FROM t_ids WHERE k='listing'); n bigint;
BEGIN
  DELETE FROM vault.decrypted_secrets WHERE name = 'email_dispatch_service_role_key';
  n := pg_temp.dispatch_count();
  UPDATE public.listings SET price = 123456 WHERE id = v_id;
  ASSERT pg_temp.dispatch_count() = n, 'missing vault secret must dispatch nothing';
  ASSERT public.dispatch_hot_sheet_listing(gen_random_uuid()) IS NULL, 'unknown listing dispatches nothing';
END $$;

-- worker cron command was rewritten to the Vault dispatcher and stays inactive
DO $$
BEGIN
  ASSERT (SELECT command FROM cron.job WHERE jobname='process-email-queue-every-minute')
         = 'SELECT public.invoke_process_email_queue();', 'worker cron command rewritten';
  ASSERT (SELECT active FROM cron.job WHERE jobname='process-email-queue-every-minute') = false,
         'worker cron must remain inactive';
  ASSERT EXISTS (SELECT 1 FROM cron.job WHERE jobname='send-new-match-notification-every-15-min' AND active = false),
         'legacy matcher cron row retained and inactive';
END $$;

SELECT 'ALL HOT SHEET DB TESTS PASSED' AS result;

ROLLBACK;
