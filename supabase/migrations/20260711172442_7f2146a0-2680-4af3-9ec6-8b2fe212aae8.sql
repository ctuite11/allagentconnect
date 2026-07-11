CREATE OR REPLACE FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid)
 RETURNS TABLE(listing_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_criteria jsonb;
  v_statuses text[];
  v_has_property_types boolean;
  v_has_cities boolean;
BEGIN
  SELECT criteria INTO v_criteria
  FROM hot_sheets WHERE id = p_hot_sheet_id AND is_active = true;

  IF v_criteria IS NULL THEN RETURN; END IF;

  v_statuses := COALESCE(
    NULLIF(ARRAY(SELECT jsonb_array_elements_text(v_criteria->'statuses')), ARRAY[]::text[]),
    ARRAY['active','new','coming_soon','back_on_market','off_market']
  );

  v_has_property_types := jsonb_typeof(v_criteria->'propertyTypes') = 'array'
    AND jsonb_array_length(v_criteria->'propertyTypes') > 0;
  v_has_cities := jsonb_typeof(v_criteria->'cities') = 'array'
    AND jsonb_array_length(v_criteria->'cities') > 0;

  RETURN QUERY
  SELECT l.id
  FROM listings l
  WHERE l.status::text = ANY(v_statuses)
    AND (v_criteria->>'state' IS NULL OR l.state = v_criteria->>'state')
    AND (NOT v_has_cities OR l.city = ANY(
      ARRAY(SELECT jsonb_array_elements_text(v_criteria->'cities'))
    ))
    AND (NOT v_has_property_types OR l.property_type::text = ANY(
      ARRAY(SELECT jsonb_array_elements_text(v_criteria->'propertyTypes'))
    ))
    AND (v_criteria->>'minPrice' IS NULL OR l.price >= (v_criteria->>'minPrice')::numeric)
    AND (v_criteria->>'maxPrice' IS NULL OR l.price <= (v_criteria->>'maxPrice')::numeric)
    AND (v_criteria->>'bedrooms' IS NULL OR l.bedrooms >= (v_criteria->>'bedrooms')::int)
    AND (v_criteria->>'bathrooms' IS NULL OR l.bathrooms >= (v_criteria->>'bathrooms')::numeric)
    AND NOT EXISTS (
      SELECT 1 FROM hot_sheet_sent_listings hssl
      WHERE hssl.hot_sheet_id = p_hot_sheet_id
        AND hssl.listing_id = l.id
        AND hssl.status_at_send = l.status::text
    );
END;
$function$;