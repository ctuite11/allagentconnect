-- ============================================================================
-- Hot Sheet reopening prerequisites (code/migration only — nothing is unpaused)
--
-- 1. public.invoke_process_email_queue()      — Vault service-role dispatcher
--                                               replacing the anon worker cron
-- 2. public.dispatch_hot_sheet_listing(uuid)  — Vault service-role listing-event
--                                               dispatcher (Authorization + apikey)
-- 3. notify_matching_buyers_on_new_listing()  — rewritten to use the dispatcher
--                                               and to cover the full Hot Sheet
--                                               status set
-- 4. public.check_hot_sheet_matches(uuid)     — criteria parity with
--                                               HotSheetCriteriaCore
--
-- OPERATOR PREREQUISITE (OUT OF BAND — not performed by this migration):
--   Create Vault secret name = 'service_role_key' whose value is the project's
--   SUPABASE_SERVICE_ROLE_KEY. Both dispatchers below skip (with a WARNING)
--   when it is missing, so applying this migration alone changes no behaviour.
--
-- This migration does NOT: unpause any stream, activate any cron, enqueue any
-- email_jobs row, write hot_sheet_sent_listings, or touch Communications
-- Center fan-out. Hot Sheet isolation is preserved end to end.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Queue worker dispatcher (replaces the anon-key cron command)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoke_process_email_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key        text;
  request_id   bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  SELECT ds.decrypted_secret
    INTO v_key
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'service_role_key'
  LIMIT 1;

  IF v_key IS NULL OR length(trim(v_key)) = 0 THEN
    RAISE WARNING
      'invoke_process_email_queue: vault secret service_role_key missing/empty; skipping';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := supabase_url || '/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) INTO request_id;

  RAISE LOG 'invoke_process_email_queue: dispatched request_id %', request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'invoke_process_email_queue failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_process_email_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_process_email_queue() TO service_role;

-- Rewrite the existing worker cron command in place, preserving its schedule
-- and — critically — its current active/inactive state (it stays inactive).
DO $$
DECLARE
  v_job cron.job%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM cron.job WHERE jobname = 'process-email-queue-every-minute';
  IF FOUND THEN
    UPDATE cron.job
       SET command = 'SELECT public.invoke_process_email_queue();'
     WHERE jobid = v_job.jobid;
    RAISE LOG 'process-email-queue-every-minute command replaced (active=%)', v_job.active;
  ELSE
    RAISE WARNING 'process-email-queue-every-minute cron job not found; nothing rewritten';
  END IF;
END $$;

-- The legacy 15-minute matcher cron supplies no listing_id and only an anon
-- bearer. It is obsolete against the current matcher; unschedule it entirely
-- so it cannot be reactivated by accident.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-new-match-notification-every-15-min') THEN
    PERFORM cron.unschedule('send-new-match-notification-every-15-min');
    RAISE LOG 'unscheduled obsolete send-new-match-notification-every-15-min';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Listing-event dispatcher — exact service-role Authorization + apikey
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_hot_sheet_listing(p_listing_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key        text;
  request_id   bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  IF p_listing_id IS NULL THEN
    RAISE WARNING 'dispatch_hot_sheet_listing: null listing id; skipping';
    RETURN NULL;
  END IF;

  SELECT ds.decrypted_secret
    INTO v_key
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'service_role_key'
  LIMIT 1;

  IF v_key IS NULL OR length(trim(v_key)) = 0 THEN
    RAISE WARNING
      'dispatch_hot_sheet_listing: vault secret service_role_key missing/empty; skipping listing %',
      p_listing_id;
    RETURN NULL;
  END IF;

  -- Hot Sheet path only. Never calls Communications Center fan-out and never
  -- calls the retired notify-agents-new-listing broadcast.
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/notify-matching-buyers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key
    ),
    body := jsonb_build_object('listing_id', p_listing_id::text)
  ) INTO request_id;

  RAISE LOG 'dispatch_hot_sheet_listing: listing % dispatched request_id %', p_listing_id, request_id;
  RETURN request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dispatch_hot_sheet_listing failed for listing %: %', p_listing_id, SQLERRM;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_hot_sheet_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_hot_sheet_listing(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Trigger: full Hot Sheet status coverage, dispatcher-backed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_matching_buyers_on_new_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  -- Mirrors HOT_SHEET_FILTER_STATUSES (src/constants/status.ts): every status a
  -- Hot Sheet can subscribe to must be able to produce a listing event.
  v_dispatchable text[] := ARRAY[
    'active','price_changed','back_on_market','off_market','extended',
    'reactivated','contingent','under_agreement','sold','rented',
    'temporarily_withdrawn','expired','canceled','coming_soon'
  ];
BEGIN
  -- Drafts and any non-subscribable status never dispatch.
  IF NEW.status IS NULL OR NOT (NEW.status::text = ANY(v_dispatchable)) THEN
    RETURN NEW;
  END IF;

  -- INSERT dispatches once. UPDATE dispatches only on a real status change, so
  -- ordinary edits cannot re-fan-out a listing.
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  PERFORM public.dispatch_hot_sheet_listing(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_matching_buyers_on_new_listing failed for listing %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_matching_buyers_trigger ON public.listings;
CREATE TRIGGER notify_matching_buyers_trigger
AFTER INSERT OR UPDATE ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.notify_matching_buyers_on_new_listing();

-- ---------------------------------------------------------------------------
-- 4. Matcher parity with HotSheetCriteriaCore (src/lib/hotSheetCriteriaCore.ts)
--
-- Enforced: state, county (id or name), cities + showAreas (neighborhoods),
-- propertyTypes, statuses, minPrice/maxPrice (honouring hasNoMin/hasNoMax),
-- bedrooms, bathrooms, acres, minSqft/maxSqft, pricePerSqft, hasParking.
--
-- NOT enforced — `rooms`: public.listings has no total-rooms column, so there
-- is nothing to compare against. Unsupported here rather than silently ignored
-- everywhere: the criterion is recorded in the criteria payload but cannot
-- narrow results until a rooms column exists. No other criterion is skipped.
--
-- Null semantics: when a criterion is set and the listing's column is NULL the
-- comparison yields NULL and the listing is excluded (conservative — a Hot
-- Sheet never matches on unknown data).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid)
RETURNS TABLE(listing_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_criteria       jsonb;
  v_statuses       text[];
  v_cities         text[];
  v_property_types text[];
  v_show_areas     boolean;
  v_county_raw     text;
  v_county_name    text;
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

  IF v_criteria IS NULL THEN RETURN; END IF;

  v_statuses := COALESCE(
    NULLIF(ARRAY(SELECT jsonb_array_elements_text(v_criteria->'statuses')), ARRAY[]::text[]),
    ARRAY['coming_soon','active','off_market','back_on_market']
  );

  v_cities := NULLIF(
    CASE WHEN jsonb_typeof(v_criteria->'cities') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(v_criteria->'cities'))
         ELSE ARRAY[]::text[] END,
    ARRAY[]::text[]
  );

  v_property_types := NULLIF(
    CASE WHEN jsonb_typeof(v_criteria->'propertyTypes') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(v_criteria->'propertyTypes'))
         ELSE ARRAY[]::text[] END,
    ARRAY[]::text[]
  );

  -- showAreas defaults to true (matches the UI default).
  v_show_areas := COALESCE((v_criteria->>'showAreas')::boolean, true);

  -- County may be stored as a counties.id UUID or as a plain county name.
  v_county_raw := NULLIF(
    COALESCE(v_criteria->>'selectedCountyId', v_criteria->>'county'), 'all'
  );
  IF v_county_raw IS NOT NULL THEN
    IF v_county_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT c.name INTO v_county_name FROM counties c WHERE c.id = v_county_raw::uuid;
    ELSE
      v_county_name := v_county_raw;
    END IF;
  END IF;

  v_has_no_min := COALESCE((v_criteria->>'hasNoMin')::boolean, false);
  v_has_no_max := COALESCE((v_criteria->>'hasNoMax')::boolean, false);
  v_min_price  := CASE WHEN v_has_no_min THEN NULL ELSE (v_criteria->>'minPrice')::numeric END;
  v_max_price  := CASE WHEN v_has_no_max THEN NULL ELSE (v_criteria->>'maxPrice')::numeric END;

  v_bedrooms       := (v_criteria->>'bedrooms')::int;
  v_bathrooms      := (v_criteria->>'bathrooms')::numeric;
  v_acres          := (v_criteria->>'acres')::numeric;
  v_min_sqft       := (v_criteria->>'minSqft')::int;
  v_max_sqft       := (v_criteria->>'maxSqft')::int;
  v_price_per_sqft := (v_criteria->>'pricePerSqft')::numeric;

  -- hasParking: true = must have parking or garage spaces, false = must have
  -- none, null/absent = "any" (unfiltered).
  v_has_parking := CASE
    WHEN v_criteria->>'hasParking' IN ('yes','true')  THEN true
    WHEN v_criteria->>'hasParking' IN ('no','false')  THEN false
    ELSE NULL
  END;

  RETURN QUERY
  SELECT l.id
  FROM listings l
  WHERE l.status::text = ANY(v_statuses)
    AND (v_criteria->>'state' IS NULL OR upper(l.state) = upper(v_criteria->>'state'))
    AND (v_county_name IS NULL OR lower(l.county) = lower(v_county_name))
    AND (
      v_cities IS NULL
      OR lower(l.city) = ANY(SELECT lower(c) FROM unnest(v_cities) AS c)
      OR (v_show_areas AND l.neighborhood IS NOT NULL
          AND lower(l.neighborhood) = ANY(SELECT lower(c) FROM unnest(v_cities) AS c))
    )
    AND (v_property_types IS NULL OR l.property_type::text = ANY(v_property_types))
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
      OR (v_has_parking = false AND
            COALESCE(l.parking_spaces, 0) = 0
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
$$;

-- === ROLLBACK NOTES ===
--   Restore the prior definitions of public.check_hot_sheet_matches(uuid) and
--   public.notify_matching_buyers_on_new_listing(), then:
--     DROP FUNCTION IF EXISTS public.dispatch_hot_sheet_listing(uuid);
--     DROP FUNCTION IF EXISTS public.invoke_process_email_queue();
--   and reset the process-email-queue-every-minute cron command to its former
--   net.http_post body.
