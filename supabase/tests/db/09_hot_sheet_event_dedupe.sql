-- Event-specific Hot Sheet delivery dedupe + internal matcher helper lockdown.
-- Disposable cluster only; rolled back. No provider, no network.
BEGIN;
-- helper hardening
DO $$ DECLARE f record; BEGIN
  SELECT p.prosecdef, p.proconfig, p.proacl::text acl INTO f FROM pg_proc p WHERE p.oid='public.hot_sheet_criteria_matches(uuid,uuid)'::regprocedure;
  ASSERT f.prosecdef = false, 'helper must be SECURITY INVOKER';
  ASSERT f.proconfig = ARRAY['search_path=""'], format('search_path must be empty, got %s', f.proconfig);
  ASSERT NOT has_function_privilege('anon','public.hot_sheet_criteria_matches(uuid,uuid)','EXECUTE'), 'anon must not execute helper';
  ASSERT NOT has_function_privilege('authenticated','public.hot_sheet_criteria_matches(uuid,uuid)','EXECUTE'), 'authenticated must not execute helper';
  ASSERT has_function_privilege('service_role','public.hot_sheet_criteria_matches(uuid,uuid)','EXECUTE'), 'service_role must execute helper';
  ASSERT f.acl NOT LIKE '%=X/%' OR f.acl NOT LIKE '{=X%', 'PUBLIC must not have EXECUTE';
  ASSERT has_function_privilege('anon','public.check_hot_sheet_matches(uuid)','EXECUTE'), 'existing matcher grants unchanged (anon)';
  ASSERT has_function_privilege('authenticated','public.check_hot_sheet_matches(uuid)','EXECUTE'), 'existing matcher grants unchanged (authenticated)';
  ASSERT NOT has_function_privilege('anon','public.enqueue_hot_sheet_delivery(uuid,uuid,text,uuid,text,text,jsonb,text,boolean,text)','EXECUTE'), 'enqueue stays service-role only';
END $$;
SELECT proacl FROM pg_proc WHERE proname='hot_sheet_criteria_matches';
-- anon/authenticated calling the helper directly -> permission denied
SET LOCAL ROLE anon;
DO $$ BEGIN PERFORM public.hot_sheet_criteria_matches(gen_random_uuid(), NULL); ASSERT false, 'anon call should fail';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'anon -> permission denied (expected)'; END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM public.hot_sheet_criteria_matches(gen_random_uuid(), NULL); ASSERT false, 'authenticated call should fail';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'authenticated -> permission denied (expected)'; END $$;
-- but the public wrapper still works for authenticated (definer -> owner calls helper)
DO $$ BEGIN PERFORM * FROM public.check_hot_sheet_matches(gen_random_uuid()); RAISE NOTICE 'authenticated -> check_hot_sheet_matches OK'; END $$;
RESET ROLE;
-- dedupe semantics
DO $$
DECLARE v_l uuid; v_hs uuid; e1 uuid; e2 uuid; e3 uuid; r jsonb;
BEGIN
  INSERT INTO public.listings(status, state, city, property_type, price) VALUES ('active','MA','Boston','condo',500000) RETURNING id INTO v_l;
  INSERT INTO public.hot_sheets(name, criteria, is_active) VALUES ('t','{}'::jsonb,true) RETURNING id INTO v_hs;
  INSERT INTO public.hot_sheet_listing_events(listing_id, trigger_op, old_status, new_status, dedupe_key, state)
    VALUES (v_l,'UPDATE','active','off_market','k1','processed') RETURNING id INTO e1;
  INSERT INTO public.hot_sheet_listing_events(listing_id, trigger_op, old_status, new_status, dedupe_key, state)
    VALUES (v_l,'UPDATE','off_market','active','k2','processed') RETURNING id INTO e2;
  INSERT INTO public.hot_sheet_listing_events(listing_id, trigger_op, old_status, new_status, dedupe_key, state)
    VALUES (v_l,'UPDATE','active','off_market','k3','processed') RETURNING id INTO e3;
  DELETE FROM public.email_jobs;
  r := public.enqueue_hot_sheet_delivery(e1, v_l, 'off_market', v_hs, 'agent', 'a@x.com', '{}'::jsonb, 'k:e1', false, NULL);
  ASSERT r->>'result'='enqueued', 'e1 enqueued';
  r := public.enqueue_hot_sheet_delivery(e1, v_l, 'off_market', v_hs, 'agent', 'A@X.com ', '{}'::jsonb, 'k:e1', false, NULL);
  ASSERT r->>'result'='duplicate', 'same event twice -> duplicate';
  r := public.enqueue_hot_sheet_delivery(e2, v_l, 'active', v_hs, 'agent', 'a@x.com', '{}'::jsonb, 'k:e2', false, NULL);
  ASSERT r->>'result'='enqueued', 'e2 enqueued';
  r := public.enqueue_hot_sheet_delivery(e3, v_l, 'off_market', v_hs, 'agent', 'a@x.com', '{}'::jsonb, 'k:e3', false, NULL);
  ASSERT r->>'result'='enqueued', 'later genuine off_market (new event) allowed';
  ASSERT (SELECT count(*) FROM public.email_jobs)=3, 'exactly 3 jobs';
  BEGIN
    r := public.enqueue_hot_sheet_delivery(NULL, v_l, 'off_market', v_hs, 'agent', 'a@x.com', '{}'::jsonb, 'k:null', false, NULL);
    ASSERT false, 'null event must fail';
  EXCEPTION WHEN raise_exception THEN RAISE NOTICE 'null event_id -> rejected (%)', SQLERRM; END;
  BEGIN
    r := public.enqueue_hot_sheet_delivery(e1, v_l, 'off_market', v_hs, 'agent', '  ', '{}'::jsonb, 'k:blank', false, NULL);
    ASSERT false, 'blank recipient must fail';
  EXCEPTION WHEN raise_exception THEN RAISE NOTICE 'blank recipient_key -> rejected (%)', SQLERRM; END;
  ASSERT (SELECT count(*) FROM public.email_jobs)=3, 'rejections create no job';
  -- helper single-listing scope
  ASSERT (SELECT count(*) FROM public.hot_sheet_criteria_matches(v_hs, v_l))=1, 'helper scoped to listing';
  ASSERT (SELECT count(*) FROM public.hot_sheet_criteria_matches(v_hs, gen_random_uuid()))=0, 'helper excludes other listing';
  RAISE NOTICE 'dedupe: same event x2 -> 1 job; off_market, active, later off_market -> 3 jobs total';
END $$;
ROLLBACK;
