-- AAC privacy database migration: applied.
-- Retained for schema history and reference; no execution is required for the
-- current application release. Delivery and cron remain separately controlled.
-- Does not modify migration_safety or any network dispatcher.
CREATE SCHEMA IF NOT EXISTS aac_privacy;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA aac_privacy FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA aac_privacy TO service_role;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS aac_privacy.original_functions (
  signature text PRIMARY KEY, definition text NOT NULL
);
REVOKE ALL ON aac_privacy.original_functions FROM PUBLIC, anon, authenticated;

-- Preserve effective authenticated/service privileges before revoking PUBLIC
-- inheritance, including grants required for authorized account operations.
CREATE TABLE IF NOT EXISTS aac_privacy.original_api_privileges (
  object_kind text, object_name text, role_name text, privilege text,
  PRIMARY KEY (object_kind, object_name, role_name, privilege)
);
INSERT INTO aac_privacy.original_api_privileges
  SELECT 'FUNCTION', format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)), role_name, 'EXECUTE'
  FROM pg_proc p CROSS JOIN unnest(ARRAY['authenticated','service_role']) role_name
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
    AND has_function_privilege(role_name, p.oid, 'EXECUTE')
  ON CONFLICT DO NOTHING;
INSERT INTO aac_privacy.original_api_privileges
  SELECT 'TABLE', format('public.%I', c.relname), role_name, privilege
  FROM pg_class c CROSS JOIN unnest(ARRAY['authenticated','service_role']) role_name
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) privilege
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p','v','m','f')
    AND has_table_privilege(role_name, c.oid, privilege)
  ON CONFLICT DO NOTHING;
INSERT INTO aac_privacy.original_api_privileges
  SELECT 'SEQUENCE', format('public.%I', c.relname), role_name, privilege
  FROM pg_class c CROSS JOIN unnest(ARRAY['authenticated','service_role']) role_name
    CROSS JOIN unnest(ARRAY['USAGE','SELECT','UPDATE']) privilege
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S'
    AND has_sequence_privilege(role_name, c.oid, privilege)
  ON CONFLICT DO NOTHING;
-- Table REVOKE does not remove column ACLs. Preserve any effective signed-in
-- column-only grants too, before removing PUBLIC/anonymous column privileges.
INSERT INTO aac_privacy.original_api_privileges
  SELECT 'TABLE', format('public.%I', c.relname), role_name, format('%s (%I)', privilege, a.attname)
  FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
    CROSS JOIN unnest(ARRAY['authenticated','service_role']) role_name
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) privilege
  WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m','f')
    AND a.attnum > 0 AND NOT a.attisdropped
    AND NOT has_table_privilege(role_name,c.oid,privilege)
    AND has_column_privilege(role_name,c.oid,a.attnum,privilege)
  ON CONFLICT DO NOTHING;
REVOKE ALL ON aac_privacy.original_api_privileges FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.privacy_network_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(auth.role() = 'service_role', false)
    OR (auth.uid() IS NOT NULL AND (public.is_verified_agent()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)));
$$;
REVOKE ALL ON FUNCTION public.privacy_network_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.privacy_network_access() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.privacy_directory_visible(p_agent uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(auth.role() = 'service_role', false) OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR p_agent = auth.uid() OR p_agent = public.current_account_owner_id()
    OR (public.privacy_network_access() AND EXISTS (
      SELECT 1 FROM public.agent_settings s WHERE s.user_id = p_agent
        AND s.agent_status = 'verified' AND NOT coalesce(s.hide_from_directory, false)));
$$;
REVOKE ALL ON FUNCTION public.privacy_directory_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.privacy_directory_visible(uuid) TO authenticated, service_role;

-- Preserve function signatures and dependencies. Internal implementations
-- reside in an unexposed schema without direct API execution privileges.
DO $migration$
DECLARE r record; impl text; call_args text; gate text; body text; finish text;
BEGIN
  FOR r IN SELECT p.*, pg_get_function_arguments(p.oid) args,
    pg_get_function_identity_arguments(p.oid) identity_args,
    pg_get_function_result(p.oid) result, pg_get_functiondef(p.oid) definition
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
      AND p.proname = ANY(ARRAY['get_public_agent_profile','get_public_listing',
        'get_public_listing_agent','get_verified_agent_ids','get_newest_verified_agents',
        'get_agent_presence','get_listing_interest_signals','listings_within_radius',
        'get_dcmls_listing','count_matching_agents','check_hot_sheet_matches',
        'get_client_favorites_for_agent','remove_client_favorite_for_agent',
        'accept_client_hot_sheet_invite','get_hot_sheet_for_member','is_email_registered_with_aac'])
  LOOP
    IF EXISTS (SELECT 1 FROM aac_privacy.original_functions
      WHERE signature = format('public.%I(%s)', r.proname, r.identity_args)) THEN CONTINUE; END IF;
    INSERT INTO aac_privacy.original_functions VALUES (format('public.%I(%s)', r.proname, r.identity_args), r.definition);
    impl := replace(r.definition, 'FUNCTION public.' || r.proname || '(',
      'FUNCTION aac_privacy.' || r.proname || '(');
    EXECUTE impl;
    EXECUTE format('REVOKE ALL ON FUNCTION aac_privacy.%I(%s) FROM PUBLIC, anon, authenticated', r.proname, r.identity_args);
    SELECT coalesce(string_agg('$' || i, ', ' ORDER BY i), '') INTO call_args
      FROM generate_series(1, r.pronargs) i;
    gate := 'public.privacy_network_access()';
    IF r.proname = 'accept_client_hot_sheet_invite' THEN
      gate := 'auth.uid() IS NOT NULL AND public.resolve_share_token($1) IS NOT NULL';
    ELSIF r.proname = 'get_hot_sheet_for_member' THEN
      gate := 'auth.uid() IS NOT NULL AND public.is_hot_sheet_participant($1)';
    ELSIF r.proname = 'get_listing_interest_signals' THEN
      gate := gate || ' AND (public.can_act_for_agent($1) OR auth.role() = ''service_role'')';
    ELSIF r.proname = 'check_hot_sheet_matches' THEN
      gate := gate || ' AND (auth.role() = ''service_role'' OR EXISTS (SELECT 1 FROM public.hot_sheets h WHERE h.id = $1 AND public.can_act_for_agent(h.user_id)))';
    END IF;
    IF r.proretset THEN
      body := format('RETURN QUERY SELECT f.* FROM aac_privacy.%I(%s) f', r.proname, call_args);
      IF r.proname = 'get_public_listing_agent' THEN
        body := body || ' WHERE public.privacy_directory_visible(f.agent_id)';
      ELSIF r.proname = 'get_newest_verified_agents' THEN
        body := body || ' WHERE public.privacy_directory_visible(f.id)';
      ELSIF r.proname IN ('get_verified_agent_ids','get_agent_presence') THEN
        body := body || ' WHERE public.privacy_directory_visible(f.user_id)';
      END IF;
      body := body || ';'; finish := 'RETURN;';
    ELSIF r.prorettype = 'void'::regtype THEN
      body := format('PERFORM aac_privacy.%I(%s); RETURN;', r.proname, call_args); finish := 'RETURN;';
    ELSE
      body := format('RETURN aac_privacy.%I(%s);', r.proname, call_args); finish := 'RETURN NULL;';
      IF r.proname = 'get_public_agent_profile' THEN
        body := format('RETURN (SELECT x.v FROM (SELECT aac_privacy.%I(%s) v) x WHERE public.privacy_directory_visible((x.v->>''id'')::uuid));', r.proname, call_args);
      END IF;
    END IF;
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql %s SECURITY DEFINER SET search_path = '''' AS %L',
      r.proname, r.args, r.result,
      CASE r.provolatile WHEN 's' THEN 'STABLE' WHEN 'i' THEN 'STABLE' ELSE 'VOLATILE' END,
      'BEGIN IF NOT coalesce((' || gate || '), false) THEN ' || finish || ' END IF; ' || body || ' END');
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.identity_args);
  END LOOP;
END $migration$;

-- Enforce network authorization while retaining status/DCMLS filters.
-- seller_matches_public retains security_invoker and owner RLS.
DO $migration$
DECLARE v text; definition text;
BEGIN
  FOREACH v IN ARRAY ARRAY['listings_public','dcmls_listings_public'] LOOP
    definition := rtrim(pg_get_viewdef(('public.' || v)::regclass, true), E'; \n');
    IF position('privacy_network_access' IN definition) = 0 THEN
      EXECUTE format('CREATE OR REPLACE VIEW public.%I WITH (security_barrier=true) AS SELECT original.* FROM (%s) original WHERE public.privacy_network_access()', v, definition);
    END IF;
  END LOOP;
END $migration$;

-- Restrictive policies intersect existing policies, including permissive ones.
DROP POLICY IF EXISTS privacy_network_read ON public.listings;
CREATE POLICY privacy_network_read ON public.listings AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.privacy_network_access());
DROP POLICY IF EXISTS privacy_directory_read ON public.agent_profiles;
CREATE POLICY privacy_directory_read ON public.agent_profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.privacy_directory_visible(id));
DROP POLICY IF EXISTS privacy_seller_matches_read ON public.seller_matches;
CREATE POLICY privacy_seller_matches_read ON public.seller_matches AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.privacy_network_access() OR public.owns_submission(submission_id));

DO $migration$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['listing_stats','listing_price_history','listing_status_history',
    'listing_views','listing_shares','listing_social_events','off_market_views'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS privacy_network_metadata ON public.%I', name);
    EXECUTE format('CREATE POLICY privacy_network_metadata ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.privacy_network_access())', name);
  END LOOP;
  FOREACH name IN ARRAY ARRAY['agent_county_preferences','agent_state_preferences','agent_buyer_coverage_areas'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS privacy_directory_metadata ON public.%I', name);
    EXECUTE format('CREATE POLICY privacy_directory_metadata ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.privacy_directory_visible(agent_id))', name);
  END LOOP;
END $migration$;

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS external_sharing_allowed boolean NOT NULL DEFAULT false;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS external_sharing_authorization text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS external_sharing_authorized_by uuid;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS external_sharing_authorized_at timestamptz;

CREATE OR REPLACE FUNCTION aac_privacy.guard_external_sharing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.external_sharing_allowed AND NEW.external_sharing_authorization IS NULL
      AND NEW.external_sharing_authorized_by IS NULL AND NEW.external_sharing_authorized_at IS NULL THEN RETURN NEW; END IF;
  ELSIF (NEW.external_sharing_allowed, NEW.external_sharing_authorization,
    NEW.external_sharing_authorized_by, NEW.external_sharing_authorized_at)
    IS NOT DISTINCT FROM (OLD.external_sharing_allowed, OLD.external_sharing_authorization,
    OLD.external_sharing_authorized_by, OLD.external_sharing_authorized_at) THEN RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> NEW.agent_id OR NOT public.is_verified_agent()
    OR (TG_OP = 'UPDATE' AND NEW.agent_id <> OLD.agent_id) THEN
    RAISE EXCEPTION 'Only the verified listing agent can authorize external sharing' USING ERRCODE = '42501';
  END IF;
  IF NEW.external_sharing_allowed AND length(btrim(coalesce(NEW.external_sharing_authorization, ''))) < 10 THEN
    RAISE EXCEPTION 'Record the seller authorization and marketing restrictions first';
  END IF;
  NEW.external_sharing_authorized_by := auth.uid();
  NEW.external_sharing_authorized_at := now();
  IF TG_OP = 'UPDATE' AND OLD.external_sharing_allowed AND NOT NEW.external_sharing_allowed THEN
    UPDATE public.listing_share_links SET revoked_at = coalesce(revoked_at, now()) WHERE listing_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS privacy_external_sharing_guard ON public.listings;
CREATE TRIGGER privacy_external_sharing_guard BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION aac_privacy.guard_external_sharing();

CREATE OR REPLACE FUNCTION public.set_listing_external_sharing(p_listing_id uuid, p_allowed boolean, p_authorization text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_verified_agent() OR p_allowed IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.listings SET external_sharing_allowed = p_allowed,
    external_sharing_authorization = left(btrim(p_authorization), 2000)
    WHERE id = p_listing_id AND agent_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501'; END IF;
  RETURN true;
END $$;

CREATE TABLE IF NOT EXISTS public.listing_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash bytea NOT NULL UNIQUE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_by uuid NOT NULL, created_by_user_id uuid, recipient_label text, created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, revoked_at timestamptz,
  CONSTRAINT listing_share_expiry CHECK (expires_at > created_at AND expires_at <= created_at + interval '366 days')
);
CREATE INDEX IF NOT EXISTS listing_share_links_creator_idx ON public.listing_share_links(created_by, listing_id);
ALTER TABLE public.listing_share_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_share_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.listing_share_links TO service_role;

CREATE TABLE IF NOT EXISTS aac_privacy.replacement_requests (
  link_id uuid REFERENCES public.listing_share_links(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL, requested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (link_id, requester_id)
);

CREATE OR REPLACE FUNCTION aac_privacy.sharing_agent(p_agent uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', p.id, 'first_name', p.first_name, 'last_name', p.last_name,
    'company', p.company, 'phone', coalesce(p.cell_phone, p.phone), 'cell_phone', p.cell_phone,
    'email', p.email, 'headshot_url', p.headshot_url)
  FROM public.agent_profiles p WHERE p.id = p_agent;
$$;

CREATE OR REPLACE FUNCTION aac_privacy.external_allowed(p_listing_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.listings l JOIN public.agent_settings s ON s.user_id = l.agent_id
    WHERE l.id = p_listing_id AND l.external_sharing_allowed
      AND l.external_sharing_authorized_by = l.agent_id AND l.external_sharing_authorized_at IS NOT NULL
      AND public.is_public_listing_status(l.status) AND s.agent_status = 'verified');
$$;

CREATE OR REPLACE FUNCTION aac_privacy.resolve_listing_share(p_token text)
RETURNS public.listing_share_links LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT k.* FROM public.listing_share_links k JOIN public.agent_settings s ON s.user_id = k.created_by
    WHERE p_token ~ '^[0-9a-f]{64}$' AND k.token_hash = extensions.digest(p_token, 'sha256')
      AND k.revoked_at IS NULL AND k.expires_at > now() AND s.agent_status = 'verified'
      AND aac_privacy.external_allowed(k.listing_id) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.create_listing_share_link(p_listing_id uuid, p_recipient_label text DEFAULT NULL, p_days integer DEFAULT 90)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE raw text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_verified_agent() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501'; END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN RAISE EXCEPTION 'invalid_expiry'; END IF;
  -- Lock the listing against concurrent permission/status changes until insertion.
  PERFORM 1 FROM public.listings WHERE id = p_listing_id FOR SHARE;
  IF NOT aac_privacy.external_allowed(p_listing_id) THEN RAISE EXCEPTION 'listing_not_shareable'; END IF;
  raw := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.listing_share_links(token_hash, listing_id, created_by, created_by_user_id, recipient_label, expires_at)
    VALUES (extensions.digest(raw, 'sha256'), p_listing_id, public.current_account_owner_id(), auth.uid(), left(p_recipient_label, 120), now() + make_interval(days => p_days));
  RETURN raw;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_listing_share_link(p_link_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  WITH u AS (UPDATE public.listing_share_links SET revoked_at = coalesce(revoked_at, now())
    WHERE id = p_link_id AND created_by = public.current_account_owner_id() AND public.can_act_for_agent(created_by) RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$$;

CREATE OR REPLACE FUNCTION public.replace_listing_share_link(p_link_id uuid, p_days integer DEFAULT 90)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE link public.listing_share_links; raw text;
BEGIN
  SELECT * INTO link FROM public.listing_share_links WHERE id = p_link_id
    AND created_by = public.current_account_owner_id() AND public.can_act_for_agent(created_by) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501'; END IF;
  raw := public.create_listing_share_link(link.listing_id, link.recipient_label, p_days);
  UPDATE public.listing_share_links SET revoked_at = coalesce(revoked_at, now()) WHERE id = link.id;
  RETURN raw;
END $$;

CREATE OR REPLACE FUNCTION public.list_listing_share_links(p_listing_id uuid)
RETURNS TABLE(id uuid, recipient_label text, created_at timestamptz, expires_at timestamptz, revoked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT k.id, k.recipient_label, k.created_at, k.expires_at, k.revoked_at
  FROM public.listing_share_links k WHERE k.listing_id = p_listing_id AND k.created_by = public.current_account_owner_id()
    AND public.is_verified_agent() ORDER BY k.created_at DESC LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION aac_privacy.safe_listing(p_listing_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', l.id, 'listing_number', l.listing_number, 'status', l.status,
    'listing_type', l.listing_type, 'property_type', l.property_type, 'address', l.address,
    'unit_number', l.unit_number, 'city', l.city, 'state', l.state, 'zip_code', l.zip_code,
    'price', l.price, 'price_range_min', l.price_range_min, 'price_range_max', l.price_range_max,
    'bedrooms', l.bedrooms, 'bathrooms', l.bathrooms, 'square_feet', l.square_feet,
    'description', l.description, 'created_at', l.created_at, 'updated_at', l.updated_at,
    'latitude', l.latitude, 'longitude', l.longitude, 'neighborhood', l.neighborhood,
    'lot_size', l.lot_size, 'year_built', l.year_built, 'list_date', l.list_date,
    'active_date', l.active_date, 'open_houses', l.open_houses,
    'photos', coalesce((SELECT jsonb_agg(jsonb_build_object('url', 'aac-private://' || l.id || '/photos/' || (n - 1)) ORDER BY n)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.photos) = 'array' THEN l.photos ELSE '[]'::jsonb END) WITH ORDINALITY t(v,n) WHERE n <= 60), '[]'::jsonb),
    'floor_plans', coalesce((SELECT jsonb_agg(jsonb_build_object('url', 'aac-private://' || l.id || '/floor_plans/' || (n - 1)) ORDER BY n)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.floor_plans) = 'array' THEN l.floor_plans ELSE '[]'::jsonb END) WITH ORDINALITY t(v,n) WHERE n <= 60), '[]'::jsonb))
  FROM public.listings l WHERE l.id = p_listing_id AND aac_privacy.external_allowed(l.id);
$$;

CREATE OR REPLACE FUNCTION public.get_shared_listing(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('listing', aac_privacy.safe_listing(k.listing_id),
    'agent', aac_privacy.sharing_agent(k.created_by), 'expires_at', k.expires_at)
  FROM aac_privacy.resolve_listing_share(p_token) k WHERE k.id IS NOT NULL;
$$;

-- Keep old Hot Sheet tokens, but do not disclose arbitrary token rows or PII.
CREATE OR REPLACE FUNCTION public.resolve_share_token(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('agent_id', st.agent_id, 'expires_at', st.expires_at,
    'accepted_at', st.accepted_at, 'accepted_by_user_id', st.accepted_by_user_id,
    'payload', jsonb_strip_nulls(jsonb_build_object('type', st.payload->>'type',
      'hot_sheet_id', coalesce(st.payload->>'hot_sheet_id', st.payload->>'hotSheetId', st.payload->>'hotsheetId'),
      'client_id', st.payload->>'client_id', 'client_email', st.payload->>'client_email',
      'client_first_name', st.payload->>'client_first_name', 'client_last_name', st.payload->>'client_last_name')))
  FROM public.share_tokens st JOIN public.agent_settings s ON s.user_id = st.agent_id
  WHERE st.token = _token AND length(_token) BETWEEN 20 AND 200
    AND st.revoked_at IS NULL AND (st.expires_at IS NULL OR st.expires_at > now())
    AND st.payload->>'type' = 'client_hotsheet_invite' AND s.agent_status = 'verified'
    AND EXISTS (SELECT 1 FROM public.hot_sheets h WHERE h.user_id = st.agent_id
      AND h.id::text = coalesce(st.payload->>'hot_sheet_id', st.payload->>'hotSheetId', st.payload->>'hotsheetId')) LIMIT 1;
$$;

-- Bind accepted-token membership to the actual signed-in recipient. Mutable
-- profile emails and another buyer's accepted token cannot establish access.
CREATE OR REPLACE FUNCTION public.is_hot_sheet_participant(p_hot_sheet_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.hot_sheets h
    WHERE h.id = p_hot_sheet_id AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.matches_current_account(h.user_id)
      OR EXISTS (SELECT 1 FROM public.client_agent_relationships r
        WHERE r.client_id = auth.uid() AND r.agent_id = h.user_id AND r.status = 'active' AND r.ended_at IS NULL
          AND (r.crm_client_id = h.client_id OR EXISTS (SELECT 1 FROM public.hot_sheet_clients c
            WHERE c.hot_sheet_id = h.id AND c.client_id = r.crm_client_id)))
      OR EXISTS (SELECT 1 FROM public.share_tokens st WHERE st.agent_id = h.user_id
        AND st.accepted_at IS NOT NULL AND st.revoked_at IS NULL AND (st.expires_at IS NULL OR st.expires_at > now())
        AND st.payload->>'type' = 'client_hotsheet_invite'
        AND coalesce(st.payload->>'hot_sheet_id', st.payload->>'hotSheetId', st.payload->>'hotsheetId') = h.id::text
        AND st.accepted_by_user_id = auth.uid())));
$$;

-- Invitation acceptance goes through the authenticated RPC, whose identity
-- check uses auth.users, never the buyer-editable profiles.email field.
DROP POLICY IF EXISTS "Clients can accept tokens via email" ON public.share_tokens;

CREATE OR REPLACE FUNCTION public.can_authenticated_buyer_view_hot_sheet_client(p_hot_sheet_id uuid, p_crm_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.hot_sheets h JOIN public.clients c ON c.agent_id = h.user_id
    WHERE h.id = p_hot_sheet_id AND c.id = p_crm_client_id
      AND (h.client_id = c.id OR EXISTS (SELECT 1 FROM public.hot_sheet_clients hc
        WHERE hc.hot_sheet_id = h.id AND hc.client_id = c.id))
      AND (EXISTS (SELECT 1 FROM public.client_agent_relationships r WHERE r.agent_id = h.user_id
        AND r.client_id = auth.uid() AND r.status = 'active' AND r.ended_at IS NULL
        AND (r.crm_client_id = c.id OR c.agent_user_id = auth.uid()))
      OR EXISTS (SELECT 1 FROM public.share_tokens st WHERE st.agent_id = h.user_id
        AND st.accepted_by_user_id = auth.uid() AND st.accepted_at IS NOT NULL AND st.revoked_at IS NULL
        AND (st.expires_at IS NULL OR st.expires_at > now()) AND st.payload->>'type' = 'client_hotsheet_invite'
        AND coalesce(st.payload->>'hot_sheet_id', st.payload->>'hotSheetId', st.payload->>'hotsheetId') = h.id::text
        AND (st.payload->>'client_id' = c.id::text OR lower(st.payload->>'client_email') = lower(c.email)))));
$$;

CREATE OR REPLACE FUNCTION aac_privacy.resolve_hot_sheet(p_token text, p_hot_sheet_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE sheet_id uuid; value text;
BEGIN
  IF p_token IS NOT NULL THEN
    SELECT coalesce(st.payload->>'hot_sheet_id', st.payload->>'hotSheetId', st.payload->>'hotsheetId') INTO value
      FROM public.share_tokens st WHERE st.token = p_token AND public.resolve_share_token(p_token) IS NOT NULL
        AND st.revoked_at IS NULL AND (st.expires_at IS NULL OR st.expires_at > now())
        AND st.payload->>'type' = 'client_hotsheet_invite' LIMIT 1;
    IF value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN sheet_id := value::uuid; END IF;
    IF sheet_id IS NULL THEN
      SELECT hot_sheet_id INTO sheet_id FROM public.hot_sheet_subscribers
        WHERE preview_token = p_token AND status = 'active' LIMIT 1;
    END IF;
  ELSIF auth.uid() IS NOT NULL AND p_hot_sheet_id IS NOT NULL
    AND public.get_hot_sheet_for_member(p_hot_sheet_id) IS NOT NULL THEN
    sheet_id := p_hot_sheet_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.hot_sheets h JOIN public.agent_settings s ON s.user_id = h.user_id
    WHERE h.id = sheet_id AND h.is_active AND s.agent_status = 'verified') THEN RETURN NULL; END IF;
  RETURN sheet_id;
END $$;

CREATE OR REPLACE FUNCTION public.get_shared_hot_sheet(p_token text DEFAULT NULL, p_hot_sheet_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('hot_sheet', jsonb_build_object('id', h.id, 'name', h.name,
      'criteria', coalesce((SELECT jsonb_object_agg(e.key,e.value) FROM jsonb_each(coalesce(h.criteria,'{}'::jsonb)) e
        WHERE e.key = ANY(ARRAY['state','selectedCountyId','county','cities','towns','showAreas','propertyTypes',
          'statuses','minPrice','maxPrice','hasNoMin','hasNoMax','bedrooms','bathrooms','rooms','acres','minSqft',
          'maxSqft','pricePerSqft','hasParking','listingNumbers','address','zipCode','listingAgreementTypes',
          'entryOnly','lenderOwned','shortSale','propertyStyles','minYearBuilt','maxYearBuilt','minLotSize',
          'maxLotSize','waterfront','waterView','beachNearby','facingDirection','minFireplaces','basement',
          'minGarageSpaces','minParkingSpaces','constructionFeatures','roofMaterials','exteriorFeatures',
          'heatingTypes','coolingTypes','greenFeatures'])), '{}'::jsonb),
      'is_active', h.is_active, 'user_id', h.user_id),
    'agent', aac_privacy.sharing_agent(h.user_id),
    'listings', coalesce((SELECT jsonb_agg(x.item ORDER BY x.created_at DESC) FROM
      (SELECT aac_privacy.safe_listing(l.id) item, l.created_at FROM public.hot_sheet_criteria_matches(h.id, NULL) m
        JOIN public.listings l ON l.id = m.listing_id WHERE aac_privacy.external_allowed(l.id)
        ORDER BY l.created_at DESC LIMIT 200) x), '[]'::jsonb))
  FROM public.hot_sheets h WHERE h.id = aac_privacy.resolve_hot_sheet(p_token, p_hot_sheet_id);
$$;

CREATE OR REPLACE FUNCTION public.get_hot_sheet_by_token(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.get_shared_hot_sheet(_token, NULL)->'hot_sheet';
$$;

CREATE OR REPLACE FUNCTION public.list_hot_sheets_for_member(_hot_sheet_ids uuid[])
RETURNS TABLE(id uuid, user_id uuid, client_id uuid, name text, criteria jsonb, is_active boolean,
  notify_client_email boolean, notify_agent_email boolean, notification_schedule text,
  last_sent_at timestamptz, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT h.id, h.user_id, h.client_id, h.name, h.criteria, h.is_active,
    h.notify_client_email, h.notify_agent_email, h.notification_schedule, h.last_sent_at, h.created_at, h.updated_at
  FROM public.hot_sheets h WHERE h.id = ANY(_hot_sheet_ids) AND public.is_hot_sheet_participant(h.id);
$$;
CREATE OR REPLACE FUNCTION public.list_my_accepted_hot_sheet_tokens()
RETURNS TABLE(token text, payload jsonb, accepted_at timestamptz, accepted_by_user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT st.token, public.resolve_share_token(st.token)->'payload', st.accepted_at, st.accepted_by_user_id
  FROM public.share_tokens st WHERE st.accepted_by_user_id = auth.uid() AND st.accepted_at IS NOT NULL
    AND public.resolve_share_token(st.token) IS NOT NULL;
$$;
CREATE OR REPLACE FUNCTION public.list_sent_listings_for_member(_hot_sheet_ids uuid[])
RETURNS TABLE(hot_sheet_id uuid, listing_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.hot_sheet_id, s.listing_id FROM public.hot_sheet_sent_listings s
  WHERE s.hot_sheet_id = ANY(_hot_sheet_ids) AND public.is_hot_sheet_participant(s.hot_sheet_id)
    AND (public.privacy_network_access() OR aac_privacy.external_allowed(s.listing_id));
$$;

CREATE OR REPLACE FUNCTION aac_privacy.buyer_listing_context(p_listing_id uuid, p_sheet_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT h.id FROM public.hot_sheets h JOIN public.agent_settings s ON s.user_id = h.user_id
  WHERE auth.uid() IS NOT NULL AND h.is_active AND s.agent_status = 'verified'
    AND (p_sheet_id IS NULL OR h.id = p_sheet_id) AND public.is_hot_sheet_participant(h.id)
    AND aac_privacy.external_allowed(p_listing_id)
    AND EXISTS (SELECT 1 FROM public.hot_sheet_criteria_matches(h.id, p_listing_id))
  ORDER BY h.created_at DESC, h.id LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.get_buyer_listing(p_listing_id uuid, p_hot_sheet_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('listing', aac_privacy.safe_listing(p_listing_id),
    'agent', aac_privacy.sharing_agent(h.user_id)) FROM public.hot_sheets h
  WHERE h.id = aac_privacy.buyer_listing_context(p_listing_id, p_hot_sheet_id);
$$;
CREATE OR REPLACE FUNCTION public.privacy_buyer_listing(p_listing_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.get_buyer_listing(p_listing_id, NULL)->'listing';
$$;
CREATE OR REPLACE FUNCTION public.get_buyer_agent(p_agent_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT aac_privacy.sharing_agent(p_agent_id) WHERE auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.client_agent_relationships r WHERE r.client_id = auth.uid()
      AND r.agent_id = p_agent_id AND r.status = 'active' AND r.ended_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.hot_sheets h WHERE h.user_id = p_agent_id AND public.is_hot_sheet_participant(h.id)));
$$;
CREATE OR REPLACE VIEW public.buyer_listings WITH (security_barrier=true) AS
  SELECT safe.*, NULL::uuid agent_id, NULL::jsonb condo_details FROM public.listings l
  CROSS JOIN LATERAL jsonb_to_record(public.privacy_buyer_listing(l.id)) AS safe(
    id uuid, address text, city text, state text, zip_code text, unit_number text,
    price numeric, price_range_min numeric, price_range_max numeric, bedrooms integer, bathrooms numeric,
    square_feet integer, property_type text, listing_type text, status text, photos jsonb, floor_plans jsonb,
    latitude numeric, longitude numeric, neighborhood text, description text, listing_number text,
    lot_size numeric, year_built integer, list_date date, active_date timestamptz,
    open_houses jsonb, created_at timestamptz, updated_at timestamptz)
  WHERE safe.id IS NOT NULL;
REVOKE ALL ON public.buyer_listings FROM PUBLIC, anon;
GRANT SELECT ON public.buyer_listings TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_buyer_favorites()
RETURNS TABLE(id uuid, listing_id uuid, created_at timestamptz, listings jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT f.id, f.listing_id, f.created_at, public.privacy_buyer_listing(f.listing_id)
  FROM public.favorites f WHERE f.user_id = auth.uid()
    AND aac_privacy.buyer_listing_context(f.listing_id, NULL) IS NOT NULL
  ORDER BY f.created_at DESC LIMIT 1000;
$$;

-- The server validates a caller JWT separately. Member calls use the caller's
-- JWT for this RPC; service-role calls must present an actual opaque token.
CREATE OR REPLACE FUNCTION public.get_shared_listing_photo_paths(p_token text, p_listing_id uuid DEFAULT NULL, p_hot_sheet_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE share public.listing_share_links; sheet_id uuid; target uuid;
BEGIN
  IF p_token IS NOT NULL THEN
    share := aac_privacy.resolve_listing_share(p_token);
    IF share.id IS NOT NULL THEN
      IF p_listing_id IS NOT NULL AND p_listing_id <> share.listing_id THEN RETURN NULL; END IF;
      target := share.listing_id;
    END IF;
  END IF;
  IF target IS NULL THEN
    sheet_id := CASE WHEN p_token IS NULL THEN aac_privacy.buyer_listing_context(p_listing_id, p_hot_sheet_id)
      ELSE aac_privacy.resolve_hot_sheet(p_token, p_hot_sheet_id) END;
    IF sheet_id IS NULL OR p_listing_id IS NULL THEN RETURN NULL; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.hot_sheet_criteria_matches(sheet_id, p_listing_id)) THEN RETURN NULL; END IF;
    target := p_listing_id;
  END IF;
  IF NOT aac_privacy.external_allowed(target) THEN RETURN NULL; END IF;
  RETURN (SELECT jsonb_build_object('photos', l.photos, 'floor_plans', l.floor_plans)
    FROM public.listings l WHERE l.id = target);
END $$;

CREATE OR REPLACE FUNCTION public.request_new_listing_share_link(p_token text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE link public.listing_share_links; changed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501'; END IF;
  -- Same response for known/unknown links; never disclose an obsolete card.
  IF p_token !~ '^[0-9a-f]{64}$' THEN RETURN true; END IF;
  SELECT * INTO link FROM public.listing_share_links WHERE token_hash = extensions.digest(p_token, 'sha256');
  IF NOT FOUND THEN RETURN true; END IF;
  INSERT INTO aac_privacy.replacement_requests(link_id, requester_id) VALUES(link.id, auth.uid())
    ON CONFLICT (link_id, requester_id) DO UPDATE SET requested_at = now()
      WHERE aac_privacy.replacement_requests.requested_at < now() - interval '1 day';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed > 0 THEN
    INSERT INTO public.agent_notifications(agent_id, type, title, body, metadata)
      VALUES(link.created_by, 'share_link_request', 'A buyer requested a new share link',
        'Review the seller sharing authorization before replacing the link.',
        jsonb_build_object('listing_id', link.listing_id, 'share_link_id', link.id, 'requester_id', auth.uid()));
  END IF;
  RETURN true;
END $$;

-- No anon table reads, and no blanket PUBLIC execute. Static county data and
-- the aggregate signup count are intentional public exceptions.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon;
DO $migration$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.oid::regclass object_name, string_agg(quote_ident(a.attname),', ' ORDER BY a.attnum) columns
    FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE c.relnamespace='public'::regnamespace AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
    GROUP BY c.oid LOOP
    EXECUTE format('REVOKE ALL (%s) ON TABLE %s FROM PUBLIC, anon',r.columns,r.object_name);
  END LOOP;
END $migration$;
GRANT SELECT ON public.counties TO anon;
GRANT INSERT ON public.agent_early_access, public.coming_soon_signups, public.agent_match_submissions TO anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

DO $migration$
DECLARE grant_row record;
BEGIN
  FOR grant_row IN SELECT * FROM aac_privacy.original_api_privileges LOOP
    EXECUTE format('GRANT %s ON %s %s TO %I', grant_row.privilege, grant_row.object_kind,
      grant_row.object_name, grant_row.role_name);
  END LOOP;
END $migration$;

-- Explicit system-only actions. Keep authenticated EXECUTE on safe defaults
-- (e.g. generate_listing_number) and RLS helpers: removing those breaks inserts.
DO $migration$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f' AND p.proname = ANY(ARRAY[
      'auto_activate_listings','cleanup_blocking_auth_identity','cleanup_orphan_auth_identity',
      'cleanup_expired_share_tokens','invoke_process_comms_digests','invoke_process_hot_sheet_events',
      'invoke_process_email_queue','process_pending_message_emails','reserve_and_enqueue_missing_opportunity_reminder',
      'build_message_email_payload','ensure_agent_role_for_user','archive_conversations_between_users',
      'agent_end_client_relationship_by_id','rate_limit_consume','auth_user_exists_by_email',
      'is_email_unsubscribed','rate_limits_cleanup','process_auth_deletion_queue',
      'sample_db_capacity','prune_db_capacity_samples','_purge_expired_agent_active_context',
      'invoke_agent_activation_nudge_once','invoke_development_notification_retry',
      'email_jobs_claim','claim_hot_sheet_events','complete_hot_sheet_event',
      'fail_hot_sheet_event','log_hot_sheet_event_stage','enqueue_hot_sheet_delivery'])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.signature);
  END LOOP;
END $migration$;
GRANT EXECUTE ON FUNCTION public.get_shared_listing(text), public.get_shared_hot_sheet(text, uuid),
  public.get_hot_sheet_by_token(text), public.resolve_share_token(text), public.get_delegate_invite_preview(text),
  public.get_verified_early_access_count(), public.migration_no_contact_status() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_shared_listing_photo_paths(text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_buyer_listing(uuid, uuid), public.privacy_buyer_listing(uuid), public.get_buyer_agent(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_buyer_favorites() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_listing_share_link(uuid, text, integer), public.revoke_listing_share_link(uuid),
  public.replace_listing_share_link(uuid, integer), public.list_listing_share_links(uuid),
  public.set_listing_external_sharing(uuid, boolean, text), public.request_new_listing_share_link(text)
  TO authenticated, service_role;

-- Service-only, late permission checks for listing-bearing email. Old queued
-- bodies without this versioned contract require review, never automatic replay.
CREATE OR REPLACE FUNCTION public.privacy_external_listing_ids(p_listing_ids uuid[], p_hot_sheet_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT l.id FROM public.listings l WHERE auth.role() = 'service_role'
    AND cardinality(p_listing_ids) BETWEEN 1 AND 200 AND l.id = ANY(p_listing_ids)
    AND aac_privacy.external_allowed(l.id)
    AND EXISTS (SELECT 1 FROM public.hot_sheets h WHERE h.id = p_hot_sheet_id AND h.is_active
      AND NOT coalesce(h.is_draft, false) AND EXISTS (SELECT 1 FROM public.agent_settings s
        WHERE s.user_id = h.user_id AND s.agent_status = 'verified'))
    AND EXISTS (SELECT 1 FROM public.hot_sheet_criteria_matches(p_hot_sheet_id, l.id));
$$;
CREATE OR REPLACE FUNCTION public.privacy_email_delivery_allowed(p_policy jsonb, p_to text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE ids uuid[]; sheet uuid; target uuid; item jsonb; agent uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_policy->>'version' IS DISTINCT FROM '1'
    OR jsonb_typeof(p_policy->'listing_ids') IS DISTINCT FROM 'array'
    OR coalesce(cardinality(p_to),0) < 1 THEN RETURN false; END IF;
  SELECT array_agg(value::uuid) INTO ids FROM jsonb_array_elements_text(p_policy->'listing_ids');
  IF coalesce(cardinality(ids),0) NOT BETWEEN 1 AND 200 THEN RETURN false; END IF;
  sheet := nullif(p_policy->>'hot_sheet_id','')::uuid;
  IF p_policy->>'audience' = 'agent' THEN
    IF sheet IS NOT NULL THEN
      SELECT h.user_id INTO agent FROM public.hot_sheets h WHERE h.id = sheet AND h.is_active;
    ELSE
      -- Internal message cards have no Hot Sheet context. The recipient must
      -- still be an actual currently verified agent, never a payload role flag.
      SELECT p.id INTO agent FROM public.agent_profiles p JOIN public.agent_settings s ON s.user_id=p.id
        WHERE lower(btrim(p.email))=lower(btrim(p_to[1])) AND s.agent_status='verified' LIMIT 1;
    END IF;
    RETURN agent IS NOT NULL AND EXISTS (SELECT 1 FROM public.agent_settings s
      WHERE s.user_id = agent AND s.agent_status = 'verified')
      AND NOT EXISTS (SELECT 1 FROM unnest(p_to) address WHERE NOT EXISTS (
        SELECT 1 FROM public.agent_profiles p WHERE p.id = agent AND lower(btrim(p.email)) = lower(btrim(address))))
      AND NOT EXISTS (SELECT 1 FROM unnest(ids) id WHERE NOT EXISTS (SELECT 1 FROM public.listings l WHERE l.id = id));
  END IF;
  IF p_policy->>'audience' IS DISTINCT FROM 'external' THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM unnest(ids) id WHERE NOT aac_privacy.external_allowed(id)) THEN RETURN false; END IF;
  IF sheet IS NOT NULL THEN
    RETURN NOT EXISTS (SELECT 1 FROM unnest(ids) id WHERE id NOT IN (
      SELECT public.privacy_external_listing_ids(ids, sheet)));
  END IF;
  IF jsonb_typeof(p_policy->'share_tokens') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_policy->'share_tokens') <> cardinality(ids) THEN RETURN false; END IF;
  FOREACH target IN ARRAY ids LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_policy->'share_tokens') token
      WHERE (public.get_shared_listing(token->>'token')->'listing'->>'id')::uuid = target) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.privacy_email_delivery_allowed(jsonb,text[]), public.privacy_external_listing_ids(uuid[],uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_email_delivery_allowed(jsonb,text[]), public.privacy_external_listing_ids(uuid[],uuid) TO service_role;

-- Future migrations must grant deliberately. This changes the applying owner's
-- defaults; every future object must still be reviewed by the catalog checks.
-- PostgreSQL's built-in PUBLIC function EXECUTE is a GLOBAL default. A
-- schema-scoped REVOKE cannot override it; remove both global and scoped ACLs.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA aac_privacy FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA aac_privacy FROM PUBLIC, anon, authenticated;

-- Confidential bucket visibility is controlled through the Storage API.
-- Restrictive policies enforce authorization alongside private bucket flags.
DROP POLICY IF EXISTS privacy_confidential_storage_read ON storage.objects;
DROP POLICY IF EXISTS privacy_confidential_storage_anon ON storage.objects;
-- Keep the anonymous policy free of authenticated-only helper calls: PostgreSQL
-- checks EXECUTE privileges even when another CASE branch permits brand assets.
CREATE POLICY privacy_confidential_storage_anon ON storage.objects AS RESTRICTIVE
  FOR SELECT TO anon USING (bucket_id NOT IN ('listing-photos','listing-floorplans','agent-match-photos','email-attachments'));
CREATE POLICY privacy_confidential_storage_read ON storage.objects AS RESTRICTIVE
  FOR SELECT TO authenticated USING (
    CASE WHEN bucket_id IN ('listing-photos','listing-floorplans')
      THEN public.privacy_network_access()
    WHEN bucket_id = 'agent-match-photos' THEN public.privacy_network_access()
      OR (auth.uid() IS NOT NULL AND split_part(name, '/', 1) = auth.uid()::text)
    WHEN bucket_id = 'email-attachments' THEN auth.uid() IS NOT NULL
      AND (public.privacy_network_access() OR split_part(name, '/', 2) = auth.uid()::text)
    ELSE true END);
DROP POLICY IF EXISTS privacy_verified_listing_media ON storage.objects;
CREATE POLICY privacy_verified_listing_media ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('listing-photos','listing-floorplans','agent-match-photos')
    AND (public.privacy_network_access() OR (bucket_id = 'agent-match-photos' AND split_part(name, '/', 1) = auth.uid()::text)));
NOTIFY pgrst, 'reload schema';
