-- Runs a fixed probe set as each role; prints one line per probe. Asserts with RAISE on failure.
CREATE OR REPLACE FUNCTION pg_temp.probe(role_name text, uid text, label text, q text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint; res text;
BEGIN
  PERFORM set_config('test.uid', coalesce(uid,''), true);
  EXECUTE format('SET LOCAL ROLE %I', role_name);
  BEGIN
    EXECUTE format('SELECT count(*) FROM (%s) q WHERE q.v IS NOT NULL', q) INTO n;
    res := n::text;
  EXCEPTION WHEN insufficient_privilege THEN res := 'DENIED'; WHEN undefined_function THEN res := 'n/a';
  END;
  RESET ROLE;
  RETURN res;
END $$;
CREATE TEMP TABLE probes(label text, q text);
INSERT INTO probes VALUES
 ('listings_public rows',            'SELECT id AS v FROM public.listings_public'),
 ('dcmls_listings_public rows',      'SELECT id AS v FROM public.dcmls_listings_public'),
 ('seller_matches_public rows',      'SELECT id AS v FROM public.seller_matches_public'),
 ('profile: verified agent',         $q$SELECT public.get_public_agent_profile('AAC-T01') AS v$q$),
 ('profile: hidden agent',           $q$SELECT public.get_public_agent_profile('AAC-T02') AS v$q$),
 ('profile: invited agent',          $q$SELECT public.get_public_agent_profile('AAC-T03') AS v$q$),
 ('profile: unverified agent',       $q$SELECT public.get_public_agent_profile('AAC-T04') AS v$q$),
 ('get_public_listing (off market)', $q$SELECT id AS v FROM public.get_public_listing('10000000-0000-0000-0000-000000000003')$q$),
 ('get_public_listing_agent',        $q$SELECT agent_id AS v FROM public.get_public_listing_agent('10000000-0000-0000-0000-000000000001')$q$),
 ('get_verified_agent_ids',          'SELECT user_id AS v FROM public.get_verified_agent_ids()'),
 ('get_newest_verified_agents',      'SELECT id AS v FROM public.get_newest_verified_agents()'),
 ('get_agent_presence',              $q$SELECT user_id AS v FROM public.get_agent_presence(ARRAY['00000000-0000-0000-0000-00000000000a'::uuid])$q$),
 ('listings_within_radius',          'SELECT listing_id AS v FROM public.listings_within_radius(42.3,-71.0,5)'),
 ('get_dcmls_listing',               $q$SELECT id AS v FROM public.get_dcmls_listing('10000000-0000-0000-0000-000000000001')$q$),
 ('ungated copy callable?',          $q$SELECT public.get_public_agent_profile__ungated('AAC-T02') AS v$q$);
CREATE TEMP TABLE roles_t(who text, role_name text, uid text, ord int);
INSERT INTO roles_t VALUES ('signed-out','anon',NULL,1),('invited','authenticated','00000000-0000-0000-0000-00000000000c',2),
 ('unverified','authenticated','00000000-0000-0000-0000-00000000000d',3),('restricted','authenticated','00000000-0000-0000-0000-00000000000e',4),
 ('verified agent','authenticated','00000000-0000-0000-0000-00000000000a',5),('hidden agent (self)','authenticated','00000000-0000-0000-0000-00000000000b',6);
GRANT SELECT ON probes, roles_t TO PUBLIC;
