-- ============================================================================
-- Hot Sheets: Residential Rental criterion + listing_type dispatch coverage
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_matching_buyers_on_new_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_dispatchable text[] := ARRAY[
    'active','price_changed','back_on_market','off_market','extended',
    'reactivated','contingent','under_agreement','sold','rented',
    'temporarily_withdrawn','expired','canceled','cancelled','coming_soon'
  ];
  v_relevant boolean;
BEGIN
  IF NEW.status IS NULL OR NOT (NEW.status::text = ANY(v_dispatchable)) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_relevant :=
         OLD.status               IS DISTINCT FROM NEW.status
      OR OLD.state                IS DISTINCT FROM NEW.state
      OR OLD.county               IS DISTINCT FROM NEW.county
      OR OLD.city                 IS DISTINCT FROM NEW.city
      OR OLD.neighborhood         IS DISTINCT FROM NEW.neighborhood
      OR OLD.property_type        IS DISTINCT FROM NEW.property_type
      -- listing_type drives the Residential Rental criterion (for_rent).
      OR OLD.listing_type         IS DISTINCT FROM NEW.listing_type
      OR OLD.price                IS DISTINCT FROM NEW.price
      OR OLD.bedrooms             IS DISTINCT FROM NEW.bedrooms
      OR OLD.bathrooms            IS DISTINCT FROM NEW.bathrooms
      OR OLD.lot_size             IS DISTINCT FROM NEW.lot_size
      OR OLD.square_feet          IS DISTINCT FROM NEW.square_feet
      OR OLD.parking_spaces       IS DISTINCT FROM NEW.parking_spaces
      OR OLD.garage_spaces        IS DISTINCT FROM NEW.garage_spaces
      OR OLD.total_parking_spaces IS DISTINCT FROM NEW.total_parking_spaces
      OR OLD.agent_id             IS DISTINCT FROM NEW.agent_id;

    IF NOT v_relevant THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM public.dispatch_hot_sheet_listing(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_matching_buyers_on_new_listing failed for listing %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS notify_matching_buyers_trigger ON public.listings;
CREATE TRIGGER notify_matching_buyers_trigger
AFTER INSERT OR UPDATE OF
  status, state, county, city, neighborhood, property_type, listing_type, price,
  bedrooms, bathrooms, lot_size, square_feet,
  parking_spaces, garage_spaces, total_parking_spaces, agent_id
ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.notify_matching_buyers_on_new_listing();

CREATE OR REPLACE FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid)
RETURNS TABLE(listing_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
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
  FROM hot_sheets WHERE id = p_hot_sheet_id AND is_active = true;

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
      SELECT c.name INTO v_county_name FROM counties c WHERE c.id = v_county_raw::uuid;
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
  FROM listings l
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
    AND NOT EXISTS (
      SELECT 1 FROM hot_sheet_sent_listings hssl
      WHERE hssl.hot_sheet_id = p_hot_sheet_id
        AND hssl.listing_id = l.id
        AND hssl.status_at_send = l.status::text
    );
END;
$fn$;