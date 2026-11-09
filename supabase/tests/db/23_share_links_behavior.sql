\set ON_ERROR_STOP 1
CREATE TEMP TABLE t(k text PRIMARY KEY, v text); GRANT ALL ON t TO PUBLIC;
CREATE FUNCTION pg_temp.ok(c boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT c THEN RAISE EXCEPTION 'FAIL: %', msg; END IF; RAISE NOTICE 'PASS: %', msg; END $$;
-- verified agent A creates links
SET test.uid = '00000000-0000-0000-0000-00000000000a'; SET ROLE authenticated;
INSERT INTO t VALUES ('good', public.create_listing_share_link('10000000-0000-0000-0000-000000000001', 'Buyer Smith'));
INSERT INTO t VALUES ('short', public.create_listing_share_link('10000000-0000-0000-0000-000000000002', NULL, 1));
DO $$ BEGIN PERFORM public.create_listing_share_link('10000000-0000-0000-0000-000000000004');
  RAISE EXCEPTION 'FAIL: draft was shareable'; EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; RAISE NOTICE 'PASS: drafts cannot be shared'; END $$;
SELECT pg_temp.ok((SELECT count(*) FROM public.listing_share_links) = 2, 'agent sees only own links');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM listing_share_links WHERE token_hash = extensions.digest((SELECT v FROM t WHERE k='good'),'sha256')) = 1
  AND NOT EXISTS (SELECT 1 FROM listing_share_links WHERE encode(token_hash,'escape') = (SELECT v FROM t WHERE k='good')), 'only token hash stored');
-- invited agent cannot create
SET test.uid = '00000000-0000-0000-0000-00000000000c'; SET ROLE authenticated;
DO $$ BEGIN PERFORM public.create_listing_share_link('10000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'FAIL: invited agent created link'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: non-verified cannot create links'; END $$;
RESET ROLE;
-- signed-out recipient
SET test.uid = ''; SET ROLE anon;
SELECT pg_temp.ok((public.get_shared_listing((SELECT v FROM t WHERE k='good'))->'listing'->>'address') = '1 Fake St', 'valid link shows its listing without an account');
SELECT pg_temp.ok((public.get_shared_listing((SELECT v FROM t WHERE k='good'))->'agent'->>'first_name') = 'Vera', 'shows sharing agent card');
SELECT pg_temp.ok(NOT (public.get_shared_listing((SELECT v FROM t WHERE k='good'))->'listing') ? 'photos', 'no photo URLs in page data');
SELECT pg_temp.ok(public.get_shared_listing('x' || repeat('A',42)) IS NULL, 'guessed token returns nothing');
SELECT pg_temp.ok(public.get_shared_listing(NULL) IS NULL, 'empty token returns nothing');
DO $$ BEGIN PERFORM 1 FROM public.listings_public; RAISE EXCEPTION 'FAIL: anon read listings_public';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: link holder still cannot browse other listings'; END $$;
DO $$ BEGIN PERFORM public.get_public_agent_profile('AAC-T01'); RAISE EXCEPTION 'FAIL: anon read agent profile';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: link holder cannot open agent profiles'; END $$;
DO $$ BEGIN PERFORM public.get_shared_listing_photo_paths((SELECT v FROM t WHERE k='good')); RAISE EXCEPTION 'FAIL: anon got photo paths';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: photo paths only for the photo service'; END $$;
DO $$ BEGIN PERFORM 1 FROM public.listing_share_links; RAISE EXCEPTION 'FAIL: anon read links table';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: link table not readable signed-out'; END $$;
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.ok(jsonb_array_length(public.get_shared_listing_photo_paths((SELECT v FROM t WHERE k='good'))) = 2, 'photo service gets paths for valid link');
RESET ROLE;
-- expiry
UPDATE listing_share_links SET expires_at = now() - interval '1 second' WHERE listing_id = '10000000-0000-0000-0000-000000000002';
SET ROLE anon; SELECT pg_temp.ok(public.get_shared_listing((SELECT v FROM t WHERE k='short')) IS NULL, 'expired link stops working'); RESET ROLE;
-- listing goes back to draft
UPDATE listings SET status='draft' WHERE id='10000000-0000-0000-0000-000000000001';
SET ROLE anon; SELECT pg_temp.ok(public.get_shared_listing((SELECT v FROM t WHERE k='good')) IS NULL, 'link stops when listing is no longer public'); RESET ROLE;
UPDATE listings SET status='active' WHERE id='10000000-0000-0000-0000-000000000001';
-- sharer loses verification
UPDATE agent_settings SET agent_status='restricted' WHERE user_id='00000000-0000-0000-0000-00000000000a';
SET ROLE anon; SELECT pg_temp.ok(public.get_shared_listing((SELECT v FROM t WHERE k='good')) IS NULL, 'link stops if sharing agent is no longer verified'); RESET ROLE;
UPDATE agent_settings SET agent_status='verified' WHERE user_id='00000000-0000-0000-0000-00000000000a';
-- revoke: other agent cannot, owner can
SET test.uid = '00000000-0000-0000-0000-00000000000b'; SET ROLE authenticated;
SELECT pg_temp.ok(NOT public.revoke_listing_share_link((SELECT id FROM listing_share_links WHERE listing_id='10000000-0000-0000-0000-000000000001')), 'another agent cannot revoke');
RESET ROLE;
SET test.uid = '00000000-0000-0000-0000-00000000000a'; SET ROLE authenticated;
SELECT pg_temp.ok(public.revoke_listing_share_link((SELECT id FROM listing_share_links WHERE listing_id='10000000-0000-0000-0000-000000000001')), 'owner can revoke');
RESET ROLE;
SET ROLE anon; SELECT pg_temp.ok(public.get_shared_listing((SELECT v FROM t WHERE k='good')) IS NULL, 'revoked link stops working'); RESET ROLE;
\echo ALL SHARE LINK ASSERTIONS PASSED
