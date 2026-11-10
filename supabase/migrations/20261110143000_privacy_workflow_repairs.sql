-- Restores authorized privacy workflows after 20261110120000_privacy_lockdown.sql.
-- Apply once as a follow-up migration. The earlier migration remains applied.
-- No email, cron, notification delivery or Storage visibility is enabled here.
BEGIN;

DO $$ BEGIN
  IF to_regprocedure('public.get_shared_listing(text)') IS NULL
    OR to_regclass('aac_privacy.original_functions') IS NULL THEN
    RAISE EXCEPTION 'Apply the base privacy migration before this follow-up';
  END IF;
END $$;

-- Workspace invitations have a real agent-owned CRM recipient, but no Hot Sheet.
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
    AND (EXISTS (SELECT 1 FROM public.hot_sheets h WHERE h.user_id = st.agent_id
      AND h.id::text = coalesce(st.payload->>'hot_sheet_id', st.payload->>'hotSheetId', st.payload->>'hotsheetId'))
      OR (st.payload->>'invite_only' = 'true'
        AND coalesce(st.payload->>'hot_sheet_id', st.payload->>'hotSheetId', st.payload->>'hotsheetId', '') = ''
        AND EXISTS (SELECT 1 FROM public.clients c WHERE c.agent_id = st.agent_id
          AND c.id::text = st.payload->>'client_id'
          AND lower(btrim(c.email)) = lower(btrim(st.payload->>'client_email'))))) LIMIT 1;
$$;

-- Preserve notification matching; use corrected matching for privacy readers.
CREATE OR REPLACE FUNCTION aac_privacy.hot_sheet_criteria_matches(p_hot_sheet_id uuid, p_listing_id uuid DEFAULT NULL)
 RETURNS TABLE(listing_id uuid)
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  v_criteria       jsonb;
  v_statuses       text[];
  v_cities         text[];
  v_property_types text[];
  v_other_types    text[];
  v_wants_rental   boolean;
  v_show_areas     boolean;
  v_state          text;
  v_zip            text;
  v_listing_type   text;
  v_listing_number text;
  v_county_raw     text;
  v_county_name    text;
  v_rooms          text;
  v_parking_raw    text;
  v_has_no_min     boolean;
  v_has_no_max     boolean;
  v_min_price      numeric;
  v_max_price      numeric;
  v_bedrooms       int;
  v_bathrooms      numeric;
  v_acres          numeric;
  v_min_sqft       int;
  v_max_sqft       int;
  v_price_per_sqft numeric;
  v_has_parking    boolean;
BEGIN
  SELECT criteria INTO v_criteria
  FROM public.hot_sheets WHERE id = p_hot_sheet_id AND is_active = true;
  IF v_criteria IS NULL OR jsonb_typeof(v_criteria) <> 'object' THEN
    RETURN;
  END IF;
  v_rooms := NULLIF(trim(COALESCE(v_criteria->>'rooms', '')), '');
  IF v_rooms IS NOT NULL THEN
    RAISE LOG 'check_hot_sheet_matches: hot sheet % sets unsupported rooms criterion (%); returning zero matches',
      p_hot_sheet_id, v_rooms;
    RETURN;
  END IF;
  -- An empty/missing status selection must not broaden token scope.
  v_statuses := CASE WHEN jsonb_typeof(v_criteria->'statuses') = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(v_criteria->'statuses')) ELSE ARRAY[]::text[] END;
  v_cities := NULLIF(ARRAY(
    SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(v_criteria->'cities') = 'array'
      THEN v_criteria->'cities' WHEN jsonb_typeof(v_criteria->'towns') = 'array'
      THEN v_criteria->'towns' ELSE '[]'::jsonb END)
    UNION SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(v_criteria->'neighborhoods') = 'array'
      THEN v_criteria->'neighborhoods' ELSE '[]'::jsonb END)), ARRAY[]::text[]);
  v_zip := nullif(btrim(v_criteria->>'zipCode'), '');
  v_listing_type := nullif(btrim(v_criteria->>'listingType'), '');
  v_listing_number := nullif(btrim(v_criteria->>'listingNumber'), '');
  v_property_types := NULLIF(
    CASE WHEN jsonb_typeof(v_criteria->'propertyTypes') = 'array'
         THEN ARRAY(SELECT CASE x WHEN 'Single Family' THEN 'single_family' WHEN 'Multi Family' THEN 'multi_family'
             WHEN 'Townhouse' THEN 'townhouse' WHEN 'Condominium' THEN 'condo'
             WHEN 'Land' THEN 'land' WHEN 'Commercial' THEN 'commercial' ELSE x END
             FROM jsonb_array_elements_text(v_criteria->'propertyTypes') x)
         ELSE ARRAY[]::text[] END,
    ARRAY[]::text[]);
  -- 'residential_rental' is a UI marker, not a listings.property_type value:
  -- it selects listings whose listing_type = 'for_rent'. Mixed selections OR
  -- together; an empty/absent selection stays unrestricted (rentals included).
  v_wants_rental := v_property_types IS NOT NULL
                    AND 'residential_rental' = ANY(v_property_types);
  v_other_types  := NULLIF(
    ARRAY(SELECT t FROM unnest(COALESCE(v_property_types, ARRAY[]::text[])) AS t
          WHERE t <> 'residential_rental'),
    ARRAY[]::text[]);
  v_show_areas := COALESCE(NULLIF(trim(COALESCE(v_criteria->>'showAreas','')), '')::boolean, true);
  v_state := NULLIF(trim(COALESCE(v_criteria->>'state','')), '');
  v_county_raw := NULLIF(
    NULLIF(trim(COALESCE(NULLIF(v_criteria->>'selectedCountyId',''), v_criteria->>'county', '')), ''),
    'all');
  IF v_county_raw IS NOT NULL THEN
    IF v_county_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT c.name INTO v_county_name FROM public.counties c WHERE c.id = v_county_raw::uuid;
      IF v_county_name IS NULL THEN
        RAISE LOG 'check_hot_sheet_matches: hot sheet % references unknown county %; returning zero matches',
          p_hot_sheet_id, v_county_raw;
        RETURN;
      END IF;
    ELSE
      v_county_name := v_county_raw;
    END IF;
  END IF;
  v_has_no_min := COALESCE(NULLIF(trim(COALESCE(v_criteria->>'hasNoMin','')), '')::boolean, false);
  v_has_no_max := COALESCE(NULLIF(trim(COALESCE(v_criteria->>'hasNoMax','')), '')::boolean, false);
  v_min_price  := CASE WHEN v_has_no_min THEN NULL
                       ELSE NULLIF(trim(COALESCE(v_criteria->>'minPrice','')), '')::numeric END;
  v_max_price  := CASE WHEN v_has_no_max THEN NULL
                       ELSE NULLIF(trim(COALESCE(v_criteria->>'maxPrice','')), '')::numeric END;
  v_bedrooms       := NULLIF(trim(COALESCE(v_criteria->>'bedrooms','')), '')::int;
  v_bathrooms      := NULLIF(trim(COALESCE(v_criteria->>'bathrooms','')), '')::numeric;
  v_acres          := NULLIF(trim(COALESCE(v_criteria->>'acres','')), '')::numeric;
  v_min_sqft       := NULLIF(trim(COALESCE(v_criteria->>'minSqft','')), '')::int;
  v_max_sqft       := NULLIF(trim(COALESCE(v_criteria->>'maxSqft','')), '')::int;
  v_price_per_sqft := NULLIF(trim(COALESCE(v_criteria->>'pricePerSqft','')), '')::numeric;
  v_parking_raw := lower(NULLIF(trim(COALESCE(v_criteria->>'hasParking','')), ''));
  v_has_parking := CASE
    WHEN v_parking_raw IN ('yes','true')  THEN true
    WHEN v_parking_raw IN ('no','false')  THEN false
    ELSE NULL
  END;
  RETURN QUERY
  SELECT l.id
  FROM public.listings l
  WHERE l.status::text = ANY(v_statuses)
    AND (v_state IS NULL OR upper(l.state) = upper(v_state))
    AND (v_county_name IS NULL OR lower(l.county) = lower(v_county_name))
    AND (
      v_cities IS NULL
      OR EXISTS (SELECT 1 FROM unnest(v_cities) AS c WHERE
        (position('-' IN c) = 0 AND lower(l.city) = lower(c))
        OR (position('-' IN c) > 0 AND lower(l.city) = lower(split_part(c, '-', 1))
          AND lower(l.neighborhood) = lower(substring(c FROM position('-' IN c) + 1))))
      OR (v_show_areas AND l.neighborhood IS NOT NULL
          AND lower(l.neighborhood) = ANY(SELECT lower(c) FROM unnest(v_cities) AS c))
    )
    AND (
      v_property_types IS NULL
      OR (v_other_types IS NOT NULL AND l.property_type::text = ANY(v_other_types))
      OR (v_wants_rental AND l.listing_type::text = 'for_rent')
    )
    AND (v_zip IS NULL OR (v_zip ~ '^[0-9]{5}$' AND l.zip_code = v_zip)
      OR (v_zip !~ '^[0-9]{5}$' AND l.zip_code ILIKE '%' || v_zip || '%'))
    AND (v_listing_type IS NULL OR l.listing_type = v_listing_type)
    AND (v_listing_number IS NULL OR l.listing_number ILIKE '%' || v_listing_number || '%')
    AND ((coalesce(v_min_price, 0) <= 0 AND coalesce(v_max_price, 0) <= 0)
      OR (l.price > 0 AND (coalesce(v_min_price, 0) <= 0 OR l.price >= v_min_price)
        AND (coalesce(v_max_price, 0) <= 0 OR l.price <= v_max_price))
      OR ((coalesce(l.price_range_min, 0) > 0 OR coalesce(l.price_range_max, 0) > 0)
        AND (coalesce(v_min_price, 0) <= 0 OR coalesce(nullif(l.price_range_max,0),nullif(l.price_range_min,0)) >= v_min_price)
        AND (coalesce(v_max_price, 0) <= 0 OR coalesce(nullif(l.price_range_min,0),nullif(l.price_range_max,0)) <= v_max_price)))
    AND (v_bedrooms IS NULL OR l.bedrooms >= v_bedrooms)
    AND (v_bathrooms IS NULL OR l.bathrooms >= v_bathrooms)
    AND (v_acres IS NULL OR l.lot_size >= v_acres)
    AND (v_min_sqft IS NULL OR l.square_feet >= v_min_sqft)
    AND (v_max_sqft IS NULL OR l.square_feet <= v_max_sqft)
    AND (
      v_price_per_sqft IS NULL
      OR (l.square_feet IS NOT NULL AND l.square_feet > 0
          AND l.price / l.square_feet <= v_price_per_sqft)
    )
    AND (
      v_has_parking IS NULL
      OR (v_has_parking = true AND (
            COALESCE(l.parking_spaces, 0) > 0
            OR COALESCE(l.garage_spaces, 0) > 0
            OR COALESCE(l.total_parking_spaces, 0) > 0))
      OR (v_has_parking = false
            AND (l.parking_spaces IS NOT NULL
                 OR l.garage_spaces IS NOT NULL
                 OR l.total_parking_spaces IS NOT NULL)
            AND COALESCE(l.parking_spaces, 0) = 0
            AND COALESCE(l.garage_spaces, 0) = 0
            AND COALESCE(l.total_parking_spaces, 0) = 0)
    )
    AND (p_listing_id IS NULL OR l.id = p_listing_id);
END;
$function$;

-- Reuse the established consumer-safe projection for the full buyer detail.
-- Media paths remain opaque; agent-only fields and documents stay excluded.
CREATE OR REPLACE FUNCTION aac_privacy.safe_listing(p_listing_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_jsonb(safe) || jsonb_build_object(
    'photos', coalesce((SELECT jsonb_agg(jsonb_build_object('url', 'aac-private://' || l.id || '/photos/' || (n - 1)) ORDER BY n)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.photos) = 'array' THEN l.photos ELSE '[]'::jsonb END) WITH ORDINALITY t(v,n) WHERE n <= 60), '[]'::jsonb),
    'floor_plans', coalesce((SELECT jsonb_agg(jsonb_build_object('url', 'aac-private://' || l.id || '/floor_plans/' || (n - 1)) ORDER BY n)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.floor_plans) = 'array' THEN l.floor_plans ELSE '[]'::jsonb END) WITH ORDINALITY t(v,n) WHERE n <= 60), '[]'::jsonb))
  FROM aac_privacy.get_public_listing(p_listing_id) safe
  JOIN public.listings l ON l.id = safe.id WHERE aac_privacy.external_allowed(l.id);
$$;

CREATE OR REPLACE FUNCTION public.get_shared_hot_sheet(p_token text DEFAULT NULL, p_hot_sheet_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('hot_sheet', jsonb_build_object('id', h.id, 'name', h.name,
      'criteria', coalesce((SELECT jsonb_object_agg(e.key,e.value) FROM jsonb_each(coalesce(h.criteria,'{}'::jsonb)) e
        WHERE e.key = ANY(ARRAY['state','selectedCountyId','county','cities','towns','neighborhoods','showAreas','propertyTypes',
          'statuses','minPrice','maxPrice','hasNoMin','hasNoMax','bedrooms','bathrooms','rooms','acres','minSqft',
          'maxSqft','pricePerSqft','hasParking','listingType','listingNumber','listingNumbers','address','zipCode','listingAgreementTypes',
          'entryOnly','lenderOwned','shortSale','propertyStyles','minYearBuilt','maxYearBuilt','minLotSize',
          'maxLotSize','waterfront','waterView','beachNearby','facingDirection','minFireplaces','basement',
          'minGarageSpaces','minParkingSpaces','constructionFeatures','roofMaterials','exteriorFeatures',
          'heatingTypes','coolingTypes','greenFeatures'])), '{}'::jsonb),
      'is_active', h.is_active, 'user_id', h.user_id),
    'agent', aac_privacy.sharing_agent(h.user_id),
    'listings', coalesce((SELECT jsonb_agg(x.item ORDER BY x.created_at DESC) FROM
      (SELECT aac_privacy.safe_listing(l.id) item, l.created_at FROM aac_privacy.hot_sheet_criteria_matches(h.id, NULL) m
        JOIN public.listings l ON l.id = m.listing_id WHERE aac_privacy.external_allowed(l.id)
        ORDER BY l.created_at DESC LIMIT 200) x), '[]'::jsonb))
  FROM public.hot_sheets h WHERE h.id = aac_privacy.resolve_hot_sheet(p_token, p_hot_sheet_id);
$$;

CREATE OR REPLACE FUNCTION aac_privacy.buyer_listing_context(p_listing_id uuid, p_sheet_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT h.id FROM public.hot_sheets h JOIN public.agent_settings s ON s.user_id = h.user_id
  WHERE auth.uid() IS NOT NULL AND h.is_active AND s.agent_status = 'verified'
    AND (p_sheet_id IS NULL OR h.id = p_sheet_id) AND public.is_hot_sheet_participant(h.id)
    AND aac_privacy.external_allowed(p_listing_id)
    AND EXISTS (SELECT 1 FROM aac_privacy.hot_sheet_criteria_matches(h.id, p_listing_id))
  ORDER BY h.created_at DESC, h.id LIMIT 1;
$$;

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
    IF NOT EXISTS (SELECT 1 FROM aac_privacy.hot_sheet_criteria_matches(sheet_id, p_listing_id)) THEN RETURN NULL; END IF;
    target := p_listing_id;
  END IF;
  IF NOT aac_privacy.external_allowed(target) THEN RETURN NULL; END IF;
  RETURN (SELECT jsonb_build_object('photos', l.photos, 'floor_plans', l.floor_plans)
    FROM public.listings l WHERE l.id = target);
END $$;

CREATE OR REPLACE FUNCTION public.privacy_external_listing_ids(p_listing_ids uuid[], p_hot_sheet_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT l.id FROM public.listings l WHERE auth.role() = 'service_role'
    AND cardinality(p_listing_ids) BETWEEN 1 AND 200 AND l.id = ANY(p_listing_ids)
    AND aac_privacy.external_allowed(l.id)
    AND EXISTS (SELECT 1 FROM public.hot_sheets h WHERE h.id = p_hot_sheet_id AND h.is_active
      AND NOT coalesce(h.is_draft, false) AND EXISTS (SELECT 1 FROM public.agent_settings s
        WHERE s.user_id = h.user_id AND s.agent_status = 'verified'))
    AND EXISTS (SELECT 1 FROM aac_privacy.hot_sheet_criteria_matches(p_hot_sheet_id, l.id));
$$;

-- DCMLS requires BOTH recorded seller approval and actual publication by a
-- participating, visible, verified agent. Keep existing column/RPC signatures.
DO $migration$
DECLARE r record; declarations text := ''; projection text := ''; separator text := '';
BEGIN
  FOR r IN SELECT a.attname, format_type(a.atttypid,a.atttypmod) typ
    FROM pg_attribute a WHERE a.attrelid='public.dcmls_listings_public'::regclass
      AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum LOOP
    IF r.attname <> ALL(ARRAY['id', 'agent_id', 'listing_number', 'status', 'listing_type', 'property_type', 'address', 'unit_number', 'building_name', 'city', 'town', 'state', 'zip_code', 'county', 'neighborhood', 'latitude', 'longitude', 'price', 'price_range_min', 'price_range_max', 'rental_fee', 'rental_fee_text', 'bedrooms', 'bathrooms', 'square_feet', 'lot_size', 'year_built', 'floors', 'garage_spaces', 'total_parking_spaces', 'parking_spaces', 'num_fireplaces', 'has_basement', 'waterfront', 'water_view', 'water_view_type', 'beach_nearby', 'handicap_access', 'handicap_accessible', 'description', 'photos', 'floor_plans', 'virtual_tour_url', 'video_url', 'property_website_url', 'property_features', 'amenities', 'property_styles', 'construction_features', 'roof_materials', 'exterior_features_list', 'heating_types', 'cooling_types', 'green_features', 'foundation_types', 'basement_types', 'basement_features_list', 'basement_floor_types', 'parking_features_list', 'garage_features_list', 'garage_additional_features_list', 'outdoor_space', 'has_storage', 'storage_options', 'laundry_type', 'pet_options', 'pets_comment', 'area_amenities', 'condo_details', 'multi_family_details', 'commercial_details', 'open_houses', 'appointment_required', 'entry_only', 'lender_owned', 'short_sale', 'annual_property_tax', 'tax_year', 'list_date', 'activation_date', 'active_date', 'go_live_date', 'created_at', 'updated_at', 'publish_to_dcmls', 'dcmls_status']) THEN
      RAISE EXCEPTION 'Unexpected DCMLS column requires privacy review: %',r.attname;
    END IF;
    declarations := declarations || separator || format('%I %s',r.attname,r.typ);
    projection := projection || separator || CASE WHEN r.attname IN ('photos','floor_plans')
      THEN format('aac_privacy.safe_listing(l.id)->%L',r.attname) ELSE format('l.%I',r.attname) END;
    separator := ', ';
  END LOOP;
  EXECUTE format('CREATE OR REPLACE FUNCTION public.get_dcmls_consumer_listings() RETURNS TABLE(%s)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '''' AS %L',declarations,
    'SELECT ' || projection || ' FROM public.listings l JOIN public.agent_settings s ON s.user_id=l.agent_id
      WHERE l.publish_to_dcmls AND l.dcmls_status=''published'' AND s.dcmls_participation
        AND NOT coalesce(s.hide_from_directory,false) AND aac_privacy.external_allowed(l.id)');
  EXECUTE 'CREATE OR REPLACE VIEW public.dcmls_listings_public WITH (security_barrier=true)
    AS SELECT * FROM public.get_dcmls_consumer_listings()';
END $migration$;

CREATE OR REPLACE FUNCTION public.get_dcmls_listing(p_listing_id uuid)
RETURNS SETOF public.dcmls_listings_public LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT * FROM public.dcmls_listings_public v WHERE v.id=p_listing_id;
$$;

CREATE OR REPLACE FUNCTION public.get_dcmls_listing_agent(p_listing_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('agent_id',p.id,'aac_id',p.aac_id,'first_name',p.first_name,'last_name',p.last_name,
    'title',p.title,'company',p.company,'office_name',p.office_name,'office_city',p.office_city,'office_state',p.office_state,
    'headshot_url',p.headshot_url,'logo_url',p.logo_url,'phone',p.phone,'office_phone',p.office_phone,
    'cell_phone',p.cell_phone,'email',p.email)
  FROM public.dcmls_listings_public l JOIN public.agent_profiles p ON p.id=l.agent_id WHERE l.id=p_listing_id;
$$;

CREATE OR REPLACE FUNCTION public.get_dcmls_agent_profile(p_id_or_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT x.profile || jsonb_build_object('testimonials',coalesce((
    SELECT jsonb_agg(t.item ORDER BY t.created_at DESC) FROM (
      SELECT jsonb_build_object('id',v.id,'client_name',v.client_name,'client_title',v.client_title,
        'testimonial_text',v.testimonial_text,'rating',v.rating,'created_at',v.created_at) item,v.created_at
      FROM public.testimonials v WHERE v.agent_id::text=x.profile->>'id' ORDER BY v.created_at DESC LIMIT 6) t),'[]'::jsonb))
  FROM (SELECT aac_privacy.get_public_agent_profile(p_id_or_code) profile) x
  WHERE EXISTS (SELECT 1 FROM public.dcmls_listings_public l WHERE l.agent_id::text=x.profile->>'id');
$$;

-- Raw Storage paths are service-only; every request rechecks publication.
CREATE OR REPLACE FUNCTION public.get_dcmls_listing_photo_paths(p_listing_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('photos',l.photos,'floor_plans',l.floor_plans) FROM public.listings l
  WHERE l.id=p_listing_id AND EXISTS (SELECT 1 FROM public.dcmls_listings_public v WHERE v.id=l.id);
$$;
REVOKE ALL ON FUNCTION public.get_dcmls_listing_photo_paths(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_dcmls_listing_photo_paths(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_dcmls_consumer_listings(),public.get_dcmls_listing(uuid),
  public.get_dcmls_listing_agent(uuid),public.get_dcmls_agent_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dcmls_consumer_listings(),public.get_dcmls_listing(uuid),
  public.get_dcmls_listing_agent(uuid),public.get_dcmls_agent_profile(text) TO anon,authenticated,service_role;
GRANT SELECT ON public.dcmls_listings_public TO anon,authenticated,service_role;

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
        jsonb_build_object('listing_id', link.listing_id, 'share_link_id', link.id, 'requester_id', auth.uid(), 'requester_name',
          (SELECT nullif(btrim(concat_ws(' ',p.first_name,p.last_name)), '') FROM public.profiles p WHERE p.id=auth.uid())));
  END IF;
  RETURN true;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA aac_privacy FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
