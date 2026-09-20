-- DCMLS V1 backend: agent participation, server-side enforcement, gated public source.
-- Additive only. No existing agent or listing is enrolled or published by this migration.

-- 1) Agent participation fields (default OFF, no backfill)
ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS dcmls_participation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dcmls_participation_at timestamptz;

-- 2) Participation audit trail
CREATE TABLE IF NOT EXISTS public.dcmls_participation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL,
  actor_user_id uuid,
  actor_role text NOT NULL,
  previous_value boolean,
  new_value boolean NOT NULL,
  listings_cleared integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dcmls_participation_audit TO authenticated;
GRANT ALL ON public.dcmls_participation_audit TO service_role;

ALTER TABLE public.dcmls_participation_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents read own dcmls participation audit" ON public.dcmls_participation_audit;
CREATE POLICY "Agents read own dcmls participation audit"
ON public.dcmls_participation_audit
FOR SELECT
TO authenticated
USING (agent_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_dcmls_participation_audit_agent
  ON public.dcmls_participation_audit (agent_user_id, created_at DESC);

-- 3) Participation lookup (SECURITY DEFINER so public gating never needs agent_settings access)
CREATE OR REPLACE FUNCTION public.agent_dcmls_participating(p_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE((
    SELECT s.dcmls_participation
    FROM public.agent_settings s
    WHERE s.user_id = p_agent_id
  ), false);
$$;

REVOKE ALL ON FUNCTION public.agent_dcmls_participating(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_dcmls_participating(uuid) TO authenticated, service_role;

-- 4) Participation change guard: only the agent themself or an admin may change it
CREATE OR REPLACE FUNCTION public.dcmls_participation_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.dcmls_participation IS NOT DISTINCT FROM OLD.dcmls_participation THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.dcmls_participation IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL THEN
    v_is_admin := public.has_role(v_uid, 'admin'::app_role);
    IF v_uid <> NEW.user_id AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Only the owning agent or an admin may change DCMLS participation';
    END IF;
  END IF;

  NEW.dcmls_participation_at :=
    CASE WHEN NEW.dcmls_participation THEN now() ELSE NULL END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dcmls_participation_guard ON public.agent_settings;
CREATE TRIGGER trg_dcmls_participation_guard
BEFORE INSERT OR UPDATE OF dcmls_participation ON public.agent_settings
FOR EACH ROW EXECUTE FUNCTION public.dcmls_participation_guard();

-- 5) Opt-out clears all listing participation atomically + writes the audit row
CREATE OR REPLACE FUNCTION public.dcmls_participation_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev boolean := CASE WHEN TG_OP = 'UPDATE' THEN OLD.dcmls_participation ELSE NULL END;
  v_cleared integer := 0;
  v_role text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.dcmls_participation IS NOT DISTINCT FROM OLD.dcmls_participation THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.dcmls_participation IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  -- Opt-out: reset every DCMLS flag on that agent's listings, same transaction.
  IF NEW.dcmls_participation IS NOT TRUE THEN
    WITH cleared AS (
      UPDATE public.listings l
         SET publish_to_dcmls = false,
             dcmls_status = 'not_published',
             dcmls_last_updated_at = now(),
             dcmls_error = NULL
       WHERE l.agent_id = NEW.user_id
         AND (l.publish_to_dcmls IS TRUE OR l.dcmls_status IS DISTINCT FROM 'not_published')
      RETURNING 1
    )
    SELECT count(*) INTO v_cleared FROM cleared;
  END IF;

  v_role := CASE
    WHEN v_uid IS NULL THEN 'system'
    WHEN v_uid = NEW.user_id THEN 'agent'
    WHEN public.has_role(v_uid, 'admin'::app_role) THEN 'admin'
    ELSE 'other'
  END;

  INSERT INTO public.dcmls_participation_audit
    (agent_user_id, actor_user_id, actor_role, previous_value, new_value, listings_cleared)
  VALUES
    (NEW.user_id, v_uid, v_role, v_prev, COALESCE(NEW.dcmls_participation, false), v_cleared);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_dcmls_participation_apply ON public.agent_settings;
CREATE TRIGGER trg_dcmls_participation_apply
AFTER INSERT OR UPDATE OF dcmls_participation ON public.agent_settings
FOR EACH ROW EXECUTE FUNCTION public.dcmls_participation_apply();

-- 6) Listing-level enforcement: DCMLS fields only, never other listing data
CREATE OR REPLACE FUNCTION public.enforce_listing_dcmls_participation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.publish_to_dcmls IS TRUE OR NEW.dcmls_status = 'published' THEN
    IF NOT public.agent_dcmls_participating(NEW.agent_id) THEN
      NEW.publish_to_dcmls := false;
      NEW.dcmls_status := 'not_published';
      NEW.dcmls_last_updated_at := now();
      NEW.dcmls_error := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_listing_dcmls_participation ON public.listings;
CREATE TRIGGER trg_enforce_listing_dcmls_participation
BEFORE INSERT OR UPDATE OF publish_to_dcmls, dcmls_status, agent_id ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_dcmls_participation();

-- 7) Gated DCMLS public source (explicit column allowlist, no agent_settings columns)
CREATE OR REPLACE VIEW public.dcmls_listings_public AS
SELECT
  l.id,
  l.agent_id,
  l.listing_number,
  l.status,
  l.listing_type,
  l.property_type,
  l.address,
  l.unit_number,
  l.building_name,
  l.city,
  l.town,
  l.state,
  l.zip_code,
  l.county,
  l.neighborhood,
  l.latitude,
  l.longitude,
  l.price,
  l.price_range_min,
  l.price_range_max,
  l.rental_fee,
  l.rental_fee_text,
  l.bedrooms,
  l.bathrooms,
  l.square_feet,
  l.lot_size,
  l.year_built,
  l.floors,
  l.garage_spaces,
  l.total_parking_spaces,
  l.parking_spaces,
  l.num_fireplaces,
  l.has_basement,
  l.waterfront,
  l.water_view,
  l.water_view_type,
  l.beach_nearby,
  l.handicap_access,
  l.handicap_accessible,
  l.description,
  l.photos,
  l.floor_plans,
  l.virtual_tour_url,
  l.video_url,
  l.property_website_url,
  l.property_features,
  l.amenities,
  l.property_styles,
  l.construction_features,
  l.roof_materials,
  l.exterior_features_list,
  l.heating_types,
  l.cooling_types,
  l.green_features,
  l.foundation_types,
  l.basement_types,
  l.basement_features_list,
  l.basement_floor_types,
  l.parking_features_list,
  l.garage_features_list,
  l.garage_additional_features_list,
  l.outdoor_space,
  l.has_storage,
  l.storage_options,
  l.laundry_type,
  l.pet_options,
  l.pets_comment,
  l.area_amenities,
  l.condo_details,
  l.multi_family_details,
  l.commercial_details,
  l.open_houses,
  l.appointment_required,
  l.entry_only,
  l.lender_owned,
  l.short_sale,
  l.annual_property_tax,
  l.tax_year,
  l.list_date,
  l.activation_date,
  l.active_date,
  l.go_live_date,
  l.created_at,
  l.updated_at,
  l.publish_to_dcmls,
  l.dcmls_status
FROM public.listings l
WHERE public.is_public_listing_status(l.status)
  AND l.publish_to_dcmls IS TRUE
  AND l.dcmls_status = 'published'
  AND public.agent_dcmls_participating(l.agent_id);

GRANT SELECT ON public.dcmls_listings_public TO anon, authenticated;

-- 8) Gated single-listing lookup (identical rule, no bypass by direct id)
CREATE OR REPLACE FUNCTION public.get_dcmls_listing(p_listing_id uuid)
RETURNS SETOF public.dcmls_listings_public
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT * FROM public.dcmls_listings_public v WHERE v.id = p_listing_id;
$$;

REVOKE ALL ON FUNCTION public.get_dcmls_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dcmls_listing(uuid) TO anon, authenticated, service_role;

-- === ROLLBACK NOTES ===
--   DROP FUNCTION IF EXISTS public.get_dcmls_listing(uuid);
--   DROP VIEW IF EXISTS public.dcmls_listings_public;
--   DROP TRIGGER IF EXISTS trg_enforce_listing_dcmls_participation ON public.listings;
--   DROP FUNCTION IF EXISTS public.enforce_listing_dcmls_participation();
--   DROP TRIGGER IF EXISTS trg_dcmls_participation_apply ON public.agent_settings;
--   DROP TRIGGER IF EXISTS trg_dcmls_participation_guard ON public.agent_settings;
--   DROP FUNCTION IF EXISTS public.dcmls_participation_apply();
--   DROP FUNCTION IF EXISTS public.dcmls_participation_guard();
--   DROP FUNCTION IF EXISTS public.agent_dcmls_participating(uuid);
--   DROP TABLE IF EXISTS public.dcmls_participation_audit;
--   ALTER TABLE public.agent_settings DROP COLUMN IF EXISTS dcmls_participation, DROP COLUMN IF EXISTS dcmls_participation_at;