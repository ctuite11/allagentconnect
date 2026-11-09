-- Minimal stand-in of production objects (same names/signatures) with FAKE data only.
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
CREATE TABLE public.agent_settings(user_id uuid PRIMARY KEY, agent_status text, hide_from_directory boolean DEFAULT false);
CREATE TABLE public.agent_profiles(id uuid PRIMARY KEY, aac_id text, first_name text, last_name text, company text, headshot_url text, office_city text, office_state text, created_at timestamptz DEFAULT now());
CREATE TABLE public.listings(id uuid PRIMARY KEY, status text, agent_id uuid, address text, price numeric, latitude float8, longitude float8, publish_to_dcmls boolean, dcmls_status text);
CREATE TABLE public.seller_matches(id uuid PRIMARY KEY, note text);
CREATE TABLE public.agent_presence(user_id uuid, last_seen_at timestamptz);
CREATE FUNCTION public.is_public_listing_status(p text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT p <> 'draft' $$;
CREATE FUNCTION public.is_verified_agent() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT EXISTS (SELECT 1 FROM public.agent_settings s WHERE s.user_id = auth.uid() AND s.agent_status='verified') $$;
GRANT EXECUTE ON FUNCTION public.is_verified_agent() TO PUBLIC;
CREATE VIEW public.listings_public WITH (security_invoker=false) AS SELECT l.id, l.status, l.agent_id, l.address, l.price FROM listings l WHERE is_public_listing_status(status);
CREATE VIEW public.dcmls_listings_public WITH (security_invoker=false) AS SELECT l.id, l.address FROM listings l WHERE is_public_listing_status(status) AND publish_to_dcmls IS TRUE AND dcmls_status = 'published';
CREATE VIEW public.seller_matches_public WITH (security_invoker=true) AS SELECT sm.id FROM seller_matches sm;
GRANT SELECT ON public.listings_public, public.dcmls_listings_public, public.seller_matches_public TO anon, authenticated;
GRANT SELECT ON public.seller_matches TO anon, authenticated;
-- Stand-ins mirror production: SECURITY DEFINER, executable by anon, no status filters.
CREATE FUNCTION public.get_public_agent_profile(p_id_or_code text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT jsonb_build_object('id', p.id, 'aac_id', p.aac_id, 'first_name', p.first_name) FROM agent_profiles p WHERE p.id::text = lower(p_id_or_code) OR p.aac_id = p_id_or_code LIMIT 1 $$;
CREATE FUNCTION public.get_public_listing(p_listing_id uuid) RETURNS TABLE(id uuid, address text, price numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT l.id, l.address, l.price FROM listings l WHERE l.id = p_listing_id AND l.status <> 'draft' $$;
CREATE FUNCTION public.get_public_listing_agent(p_listing_id uuid) RETURNS TABLE(agent_id uuid, first_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT p.id, p.first_name FROM listings l JOIN agent_profiles p ON p.id = l.agent_id WHERE l.id = p_listing_id $$;
CREATE FUNCTION public.get_verified_agent_ids() RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT user_id FROM agent_settings WHERE agent_status='verified' $$;
CREATE FUNCTION public.get_newest_verified_agents(_limit integer DEFAULT 12) RETURNS TABLE(id uuid, first_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT p.id, p.first_name FROM agent_profiles p JOIN agent_settings s ON s.user_id=p.id WHERE s.agent_status='verified' LIMIT _limit $$;
CREATE FUNCTION public.get_agent_presence(user_ids uuid[]) RETURNS TABLE(user_id uuid, last_seen_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT user_id, last_seen_at FROM agent_presence WHERE user_id = ANY(user_ids) $$;
CREATE FUNCTION public.get_listing_interest_signals(p_agent_id uuid, p_listing_ids uuid[]) RETURNS TABLE(listing_id uuid, saves_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT unnest(p_listing_ids), 0::bigint $$;
CREATE FUNCTION public.listings_within_radius(origin_lat double precision, origin_lng double precision, radius_miles double precision) RETURNS TABLE(listing_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT id FROM listings WHERE latitude IS NOT NULL $$;
CREATE FUNCTION public.get_dcmls_listing(p_listing_id uuid) RETURNS SETOF dcmls_listings_public LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT * FROM dcmls_listings_public WHERE id = p_listing_id $$;
DO $$ DECLARE f record; BEGIN FOR f IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE pronamespace='public'::regnamespace LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f.sig); END LOOP; END $$;
-- FAKE fixtures
INSERT INTO agent_settings VALUES
 ('00000000-0000-0000-0000-00000000000a','verified',false),   -- verified viewer
 ('00000000-0000-0000-0000-00000000000b','verified',true),    -- hidden verified
 ('00000000-0000-0000-0000-00000000000c','invited',false),
 ('00000000-0000-0000-0000-00000000000d','unverified',false),
 ('00000000-0000-0000-0000-00000000000e','restricted',false);
INSERT INTO agent_profiles(id, aac_id, first_name) VALUES
 ('00000000-0000-0000-0000-00000000000a','AAC-T01','Vera'),('00000000-0000-0000-0000-00000000000b','AAC-T02','Hidden'),
 ('00000000-0000-0000-0000-00000000000c','AAC-T03','Invited'),('00000000-0000-0000-0000-00000000000d','AAC-T04','Unverified'),
 ('00000000-0000-0000-0000-00000000000e','AAC-T05','Restricted');
INSERT INTO listings VALUES
 ('10000000-0000-0000-0000-000000000001','active','00000000-0000-0000-0000-00000000000a','1 Fake St',1000000,42.3,-71.0,true,'published'),
 ('10000000-0000-0000-0000-000000000002','coming_soon','00000000-0000-0000-0000-00000000000a','2 Fake St',2000000,42.3,-71.0,false,null),
 ('10000000-0000-0000-0000-000000000003','off_market','00000000-0000-0000-0000-00000000000b','3 Fake St',3000000,42.3,-71.0,false,null),
 ('10000000-0000-0000-0000-000000000004','draft','00000000-0000-0000-0000-00000000000a','4 Fake St',4000000,42.3,-71.0,false,null);
INSERT INTO seller_matches VALUES ('20000000-0000-0000-0000-000000000001','fake');
INSERT INTO agent_presence VALUES ('00000000-0000-0000-0000-00000000000a', now());
