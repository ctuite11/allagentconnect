-- ============================================================================
-- Hot Sheet reopening prerequisites (migration prepared only — nothing unpaused)
--
-- 1. public.invoke_process_email_queue()      — Vault service-role worker dispatcher
-- 2. public.dispatch_hot_sheet_listing(uuid)  — Vault service-role listing-event
--                                               dispatcher (Authorization + apikey)
-- 3. notify_matching_buyers_on_new_listing()  — column-scoped dispatch coverage
-- 4. public.check_hot_sheet_matches(uuid)     — fail-closed criteria parity with
--                                               HotSheetCriteriaCore
--
-- OPERATOR PREREQUISITE (OUT OF BAND — not performed here):
--   Create Vault secret 'email_dispatch_service_role_key' holding the project's
--   service-role key. Both dispatchers skip with a WARNING when it is missing,
--   so applying this migration alone changes no outbound behaviour.
--
-- This migration does NOT unpause a stream, activate a cron, enqueue an
-- email_jobs row, write hot_sheet_sent_listings, or touch Communications Center
-- fan-out. Hot Sheet isolation is preserved end to end.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Queue worker dispatcher (replaces the anon-key cron command)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoke_process_email_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_key        text;
  request_id   bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  SELECT ds.decrypted_secret INTO v_key
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'email_dispatch_service_role_key'
  LIMIT 1;

  IF v_key IS NULL OR length(trim(v_key)) = 0 THEN
    RAISE WARNING 'invoke_process_email_queue: vault secret email_dispatch_service_role_key missing/empty; skipping';
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
$fn$;

REVOKE ALL ON FUNCTION public.invoke_process_email_queue() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoke_process_email_queue() FROM anon;
REVOKE ALL ON FUNCTION public.invoke_process_email_queue() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_process_email_queue() TO service_role;

-- Rewrite the worker cron command with cron.alter_job so pg_cron owns the edit:
-- schedule and current active/inactive state are preserved (it stays inactive).
-- No direct UPDATE on cron.job.
DO $do$
DECLARE
  v_jobid  bigint;
  v_active boolean;
BEGIN
  SELECT jobid, active INTO v_jobid, v_active
  FROM cron.job WHERE jobname = 'process-email-queue-every-minute';

  IF v_jobid IS NULL THEN
    RAISE WARNING 'process-email-queue-every-minute cron job not found; nothing rewritten';
  ELSE
    PERFORM cron.alter_job(
      job_id  => v_jobid,
      command => 'SELECT public.invoke_process_email_queue();'
    );
    RAISE LOG 'process-email-queue-every-minute command replaced (active=%)', v_active;
  END IF;
END
$do$;

-- The legacy 15-minute matcher cron supplies no listing_id and only an anon
-- bearer, so its command is obsolete. It is deliberately NOT unscheduled: the
-- disabled row is retained for audit history and rollback.
DO $do$
DECLARE
  v_active boolean;
BEGIN
  SELECT active INTO v_active
  FROM cron.job WHERE jobname = 'send-new-match-notification-every-15-min';

  IF v_active IS NULL THEN
    RAISE LOG 'send-new-match-notification-every-15-min not present; nothing to preserve';
  ELSIF v_active THEN
    RAISE EXCEPTION 'send-new-match-notification-every-15-min is active; refusing to proceed while a legacy matcher cron can fire';
  ELSE
    RAISE LOG 'send-new-match-notification-every-15-min retained, inactive (obsolete command kept for audit)';
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- 2. Listing-event dispatcher — exact service-role Authorization + apikey
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_hot_sheet_listing(p_listing_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_key        text;
  request_id   bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  IF p_listing_id IS NULL THEN
    RAISE WARNING 'dispatch_hot_sheet_listing: null listing id; skipping';
    RETURN NULL;
  END IF;

  -- Fail closed: never issue an HTTP request for a listing row that does not exist.
  IF NOT EXISTS (SELECT 1 FROM public.listings l WHERE l.id = p_listing_id) THEN
    RAISE WARNING 'dispatch_hot_sheet_listing: listing % not found; skipping', p_listing_id;
    RETURN NULL;
  END IF;

  SELECT ds.decrypted_secret INTO v_key
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'email_dispatch_service_role_key'
  LIMIT 1;

  IF v_key IS NULL OR length(trim(v_key)) = 0 THEN
    RAISE WARNING 'dispatch_hot_sheet_listing: vault secret email_dispatch_service_role_key missing/empty; skipping listing %', p_listing_id;
    RETURN NULL;
  END IF;

  -- Hot Sheet path only: the single downstream call is notify-matching-buyers,
  -- which forwards this exact listing id to the Hot Sheet matcher. No
  -- Communications Center fan-out, no retired broad listing broadcast.
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
$fn$;

REVOKE ALL ON FUNCTION public.dispatch_hot_sheet_listing(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_hot_sheet_listing(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.dispatch_hot_sheet_listing(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_hot_sheet_listing(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Trigger: dispatch on any change that can newly satisfy a Hot Sheet
--
-- An unchanged status still matters: a price drop, a town correction, a
-- property-type fix, a bed/bath/size/parking correction, or an ownership
-- (agent_id) change can each make a listing newly matchable. Only a real change
-- to a match-relevant column dispatches; updated_at and unrelated edits do not.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_matching_buyers_on_new_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  -- Mirrors HOT_SHEET_FILTER_STATUSES (src/constants/status.ts). Both the
  -- canonical 'canceled' and the legacy 'cancelled' spelling are accepted.
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
      OR OLD.price                IS DISTINCT FROM NEW.price
      OR OLD.bedrooms             IS DISTINCT FROM NEW.bedrooms
      OR OLD.bathrooms            IS DISTINCT FROM NEW.bathrooms
      OR OLD.lot_size             IS DISTINCT FROM NEW.lot_size
      OR OLD.square_feet          IS DISTINCT FROM NEW.square_feet
      OR OLD.parking_spaces       IS DISTINCT FROM NEW.parking_spaces
      OR OLD.garage_spaces        IS DISTINCT FROM NEW.garage_spaces
      OR OLD.total_parking_spaces IS DISTINCT FROM NEW.total_parking_spaces
      -- agent_id matters: self-owned listings are excluded from agent delivery.
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
  status, state, county, city, neighborhood, property_type, price,
  bedrooms, bathrooms, lot_size, square_feet,
  parking_spaces, garage_spaces, total_parking_spaces, agent_id
ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.notify_matching_buyers_on_new_listing();

-- ---------------------------------------------------------------------------
-- 4. Matcher parity with HotSheetCriteriaCore (src/lib/hotSheetCriteriaCore.ts)
--
-- Enforced: state, county (id or name), cities + showAreas (neighborhoods),
-- propertyTypes, statuses, minPrice/maxPrice (honouring hasNoMin/hasNoMax),
-- bedrooms, bathrooms, acres, minSqft/maxSqft, pricePerSqft, hasParking.
--
-- FAIL-CLOSED SEMANTICS
--   * Every numeric/integer/boolean cast is guarded with NULLIF(trim(...),'')
--     so legacy empty-string criteria cannot raise and abort the matcher.
--   * statuses/cities/propertyTypes expand only when jsonb_typeof = 'array'.
--   * A county UUID that resolves to no counties row yields ZERO matches — the
--     county filter is never silently dropped.
--   * hasParking = 'no' requires positive evidence: at least one parking column
--     must be non-NULL. All-unknown parking data is not proof of zero parking.
--   * NOT enforced — `rooms` has no listing column. Rather than silently
--     ignoring it (which produces false-positive emails), a nonempty rooms
--     criterion returns ZERO matches until a real rooms column exists. The Hot
--     Sheet create/edit UI no longer offers Rooms, so nothing new can save it.
--
-- lot_size units: public.listings.lot_size is the acreage column (Listing detail
-- renders "acres"; AddListing validates acres, max 10,000). Live data holds zero
-- non-NULL lot_size rows, so there is no empirical contradiction and no unit
-- conversion is applied. Tracked separately: the ATTOM autofill path writes
-- lotSizeSqft into this acreage field — a producer-side bug, not a matcher bug.
--
-- Null semantics: when a criterion is set and the listing column is NULL the
-- comparison yields NULL and the listing is excluded.
-- ---------------------------------------------------------------------------
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

  -- Unsupported criterion: fail closed rather than emit false positives.
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

  -- showAreas defaults to true (matches the UI default).
  v_show_areas := COALESCE(NULLIF(trim(COALESCE(v_criteria->>'showAreas','')), '')::boolean, true);

  v_state := NULLIF(trim(COALESCE(v_criteria->>'state','')), '');

  -- County may be a counties.id UUID or a plain county name. An unresolvable
  -- UUID must produce zero matches, never an unfiltered result.
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

  -- hasParking: yes = must have spaces, no = must have none (with evidence),
  -- any/absent/empty = unfiltered.
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
      OR (v_has_parking = false
            -- Positive evidence required: all-NULL parking never matches "no".
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

-- === ROLLBACK NOTES ===
--   Restore the prior definitions of public.check_hot_sheet_matches(uuid) and
--   public.notify_matching_buyers_on_new_listing(), recreate
--   notify_matching_buyers_trigger as AFTER INSERT OR UPDATE (all columns), then
--     DROP FUNCTION IF EXISTS public.dispatch_hot_sheet_listing(uuid);
--     DROP FUNCTION IF EXISTS public.invoke_process_email_queue();
--   and cron.alter_job() process-email-queue-every-minute back to its former
--   command. The send-new-match-notification-every-15-min row is untouched.
