-- 1. Add status_at_send column with backfill
ALTER TABLE public.hot_sheet_sent_listings
  ADD COLUMN IF NOT EXISTS status_at_send text;

-- Backfill existing rows: join to listings to get actual status, default 'active'
UPDATE public.hot_sheet_sent_listings hsl
SET status_at_send = COALESCE(l.status, 'active')
FROM public.listings l
WHERE hsl.listing_id = l.id
  AND hsl.status_at_send IS NULL;

-- Any orphan rows (listing deleted) get 'active'
UPDATE public.hot_sheet_sent_listings
SET status_at_send = 'active'
WHERE status_at_send IS NULL;

-- Make NOT NULL
ALTER TABLE public.hot_sheet_sent_listings
  ALTER COLUMN status_at_send SET NOT NULL;

-- Drop old unique constraints
DROP INDEX IF EXISTS public.hot_sheet_sent_listings_unique;
ALTER TABLE public.hot_sheet_sent_listings
  DROP CONSTRAINT IF EXISTS hot_sheet_sent_listings_hot_sheet_id_listing_id_key;

-- Create new unique index including status_at_send
CREATE UNIQUE INDEX hot_sheet_sent_listings_hs_listing_status_unique
  ON public.hot_sheet_sent_listings (hot_sheet_id, listing_id, status_at_send);

-- 2. Replace check_hot_sheet_matches to support back_on_market + status-criteria matching + status-aware dedup
CREATE OR REPLACE FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid)
  RETURNS TABLE(listing_id uuid)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_criteria JSONB;
  v_user_id UUID;
  v_has_status_filter boolean;
BEGIN
  SELECT criteria, user_id INTO v_criteria, v_user_id
  FROM public.hot_sheets
  WHERE id = p_hot_sheet_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_has_status_filter := (
    v_criteria->'statuses' IS NOT NULL
    AND jsonb_typeof(v_criteria->'statuses') = 'array'
    AND jsonb_array_length(v_criteria->'statuses') > 0
  );

  RETURN QUERY
  SELECT DISTINCT l.id
  FROM public.listings l
  WHERE
    CASE
      WHEN v_has_status_filter THEN
        l.status = ANY(SELECT jsonb_array_elements_text(v_criteria->'statuses'))
      ELSE
        l.status IN ('active', 'new', 'coming_soon', 'off_market', 'back_on_market')
    END
    AND NOT EXISTS (
      SELECT 1 FROM public.hot_sheet_sent_listings hsl
      WHERE hsl.hot_sheet_id = p_hot_sheet_id
        AND hsl.listing_id = l.id
        AND hsl.status_at_send = l.status
    )
    AND (
      (v_criteria->'propertyTypes')::jsonb IS NULL
      OR jsonb_array_length(COALESCE(v_criteria->'propertyTypes', '[]'::jsonb)) = 0
      OR l.property_type = ANY(SELECT jsonb_array_elements_text(v_criteria->'propertyTypes'))
    )
    AND (
      (v_criteria->>'state') IS NULL
      OR l.state = (v_criteria->>'state')
    )
    AND (
      (v_criteria->'cities')::jsonb IS NULL
      OR jsonb_array_length(COALESCE(v_criteria->'cities', '[]'::jsonb)) = 0
      OR l.city = ANY(SELECT jsonb_array_elements_text(v_criteria->'cities'))
    )
    AND (
      (v_criteria->>'maxPrice') IS NULL
      OR l.price <= (v_criteria->>'maxPrice')::numeric
    )
    AND (
      (v_criteria->>'minPrice') IS NULL
      OR l.price >= (v_criteria->>'minPrice')::numeric
    )
    AND (
      (v_criteria->>'bedrooms') IS NULL
      OR l.bedrooms >= (v_criteria->>'bedrooms')::integer
    )
    AND (
      (v_criteria->>'bathrooms') IS NULL
      OR l.bathrooms >= (v_criteria->>'bathrooms')::numeric
    );
END;
$$;

-- 3. Update trigger to fire on INSERT OR UPDATE and include back_on_market
DROP TRIGGER IF EXISTS notify_matching_buyers_trigger ON public.listings;

CREATE OR REPLACE FUNCTION public.notify_matching_buyers_on_new_listing()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('active', 'back_on_market') THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
      RETURN NEW;
    END IF;
    IF NEW.status NOT IN ('active', 'back_on_market') THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT net.http_post(
    url := supabase_url || '/functions/v1/notify-matching-buyers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'listing_id', NEW.id::text,
      'address', NEW.address,
      'city', NEW.city,
      'state', NEW.state,
      'price', NEW.price,
      'property_type', NEW.property_type,
      'bedrooms', NEW.bedrooms,
      'bathrooms', NEW.bathrooms,
      'square_feet', NEW.square_feet
    )
  ) INTO request_id;

  RAISE LOG 'Triggered buyer notification for listing % (status: %) with request_id %', NEW.id, NEW.status, request_id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger buyer notification for listing %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER notify_matching_buyers_trigger
  AFTER INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION notify_matching_buyers_on_new_listing();