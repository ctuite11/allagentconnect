-- Hot Sheet event-specific delivery dedupe (claim key = event + Hot Sheet + audience + recipient).
-- 1. New event-scoped unique protection (created before the old key is dropped)
CREATE UNIQUE INDEX hot_sheet_delivery_claims_event_key
  ON public.hot_sheet_delivery_claims (event_id, hot_sheet_id, audience, recipient_key);

-- 2. Claim RPC: same signature/security/pause/job logic; event-scoped conflict target
CREATE OR REPLACE FUNCTION public.enqueue_hot_sheet_delivery(p_event_id uuid, p_listing_id uuid, p_status text, p_hot_sheet_id uuid, p_audience text, p_recipient_key text, p_payload jsonb, p_idempotency_key text, p_paused boolean DEFAULT true, p_pause_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_claim_id uuid;
  v_job_id uuid;
BEGIN
  PERFORM public.assert_service_role();

  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event_id is required';
  END IF;
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
  ON CONFLICT (event_id, hot_sheet_id, audience, recipient_key) DO NOTHING
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
$function$;


-- 4. Internal criteria helper (criteria copied verbatim from live check_hot_sheet_matches,
--    minus the sent-state filter, plus an optional single-listing scope)
CREATE FUNCTION public.hot_sheet_criteria_matches(p_hot_sheet_id uuid, p_listing_id uuid DEFAULT NULL)
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
  v_statuses := COALESCE(
    NULLIF(
      CASE WHEN jsonb_typeof(v_criteria->'statuses') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(v_criteria->'statuses'))
           ELSE ARRAY[]::text[] END,
      ARRAY[]::text[]),
    ARRAY['coming_soon','active','off_market','back_on_market']
  );
  v_cities := NULLIF(
    CASE WHEN jsonb_typeof(v_criteria->'cities') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(v_criteria->'cities'))
         ELSE ARRAY[]::text[] END,
    ARRAY[]::text[]);
  v_property_types := NULLIF(
    CASE WHEN jsonb_typeof(v_criteria->'propertyTypes') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(v_criteria->'propertyTypes'))
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
      OR lower(l.city) = ANY(SELECT lower(c) FROM unnest(v_cities) AS c)
      OR (v_show_areas AND l.neighborhood IS NOT NULL
          AND lower(l.neighborhood) = ANY(SELECT lower(c) FROM unnest(v_cities) AS c))
    )
    AND (
      v_property_types IS NULL
      OR (v_other_types IS NOT NULL AND l.property_type::text = ANY(v_other_types))
      OR (v_wants_rental AND l.listing_type::text = 'for_rent')
    )
    AND (v_min_price IS NULL OR l.price >= v_min_price)
    AND (v_max_price IS NULL OR l.price <= v_max_price)
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

REVOKE ALL ON FUNCTION public.hot_sheet_criteria_matches(uuid, uuid) FROM PUBLIC, anon, authenticated;
DO $rv$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT pg_get_userbyid(a.grantee) AS g
      FROM pg_proc p, LATERAL aclexplode(p.proacl) a
     WHERE p.oid = 'public.hot_sheet_criteria_matches(uuid, uuid)'::regprocedure
       AND a.grantee <> 0 AND a.grantee <> p.proowner
       AND pg_get_userbyid(a.grantee) <> 'service_role'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.hot_sheet_criteria_matches(uuid, uuid) FROM %I', r.g);
  END LOOP;
END $rv$;
GRANT EXECUTE ON FUNCTION public.hot_sheet_criteria_matches(uuid, uuid) TO service_role;
COMMENT ON FUNCTION public.hot_sheet_criteria_matches(uuid, uuid) IS
  'INTERNAL: Hot Sheet criteria only (no sent-state filter). service_role only. Single source of criteria for check_hot_sheet_matches.';

-- 5. Public matcher becomes a thin wrapper: identical results (criteria + same sent-state filter)
CREATE OR REPLACE FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid)
 RETURNS TABLE(listing_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT m.listing_id
    FROM public.hot_sheet_criteria_matches(p_hot_sheet_id, NULL) m
    JOIN public.listings l ON l.id = m.listing_id
   WHERE NOT EXISTS (
     SELECT 1 FROM public.hot_sheet_sent_listings hssl
      WHERE hssl.hot_sheet_id = p_hot_sheet_id
        AND hssl.listing_id = l.id
        AND hssl.status_at_send = l.status::text
   );
END;
$function$;

-- 6. LAST: retire the status-keyed logical key (it blocks genuine repeat transitions)
DROP INDEX public.hot_sheet_delivery_claims_logical_key;