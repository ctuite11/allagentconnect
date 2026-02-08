
-- Ticket 9, Change 1: Fix check_hot_sheet_matches to match pipeline statuses,
-- remove 24h window, and dedup against hot_sheet_sent_listings.

CREATE OR REPLACE FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid)
 RETURNS TABLE(listing_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_criteria JSONB;
  v_user_id UUID;
BEGIN
  -- Get hot sheet criteria and user
  SELECT criteria, user_id INTO v_criteria, v_user_id
  FROM public.hot_sheets
  WHERE id = p_hot_sheet_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Find matching listings that haven't been sent yet
  RETURN QUERY
  SELECT DISTINCT l.id
  FROM public.listings l
  WHERE l.status IN ('active', 'new', 'coming_soon', 'off_market')
    -- Dedup: skip listings already sent for this hot sheet
    AND NOT EXISTS (
      SELECT 1 FROM public.hot_sheet_sent_listings hsl
      WHERE hsl.hot_sheet_id = p_hot_sheet_id
      AND hsl.listing_id = l.id
    )
    -- Check property type
    AND (
      (v_criteria->'propertyTypes')::jsonb IS NULL
      OR jsonb_array_length(COALESCE(v_criteria->'propertyTypes', '[]'::jsonb)) = 0
      OR l.property_type = ANY(
        SELECT jsonb_array_elements_text(v_criteria->'propertyTypes')
      )
    )
    -- Check state
    AND (
      (v_criteria->>'state') IS NULL
      OR l.state = (v_criteria->>'state')
    )
    -- Check cities
    AND (
      (v_criteria->'cities')::jsonb IS NULL
      OR jsonb_array_length(COALESCE(v_criteria->'cities', '[]'::jsonb)) = 0
      OR l.city = ANY(
        SELECT jsonb_array_elements_text(v_criteria->'cities')
      )
    )
    -- Check max price
    AND (
      (v_criteria->>'maxPrice') IS NULL
      OR l.price <= (v_criteria->>'maxPrice')::numeric
    )
    -- Check min price
    AND (
      (v_criteria->>'minPrice') IS NULL
      OR l.price >= (v_criteria->>'minPrice')::numeric
    )
    -- Check bedrooms
    AND (
      (v_criteria->>'bedrooms') IS NULL
      OR l.bedrooms >= (v_criteria->>'bedrooms')::integer
    )
    -- Check bathrooms
    AND (
      (v_criteria->>'bathrooms') IS NULL
      OR l.bathrooms >= (v_criteria->>'bathrooms')::numeric
    );
END;
$function$;

-- Safety: ensure unique constraint for upsert dedup
CREATE UNIQUE INDEX IF NOT EXISTS hot_sheet_sent_listings_unique
ON public.hot_sheet_sent_listings (hot_sheet_id, listing_id);
