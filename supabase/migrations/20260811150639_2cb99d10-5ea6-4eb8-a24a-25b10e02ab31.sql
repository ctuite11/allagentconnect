BEGIN;

DROP POLICY IF EXISTS "Anyone can view published listings" ON public.listings;

CREATE POLICY "Authenticated can view published listings"
ON public.listings
FOR SELECT
TO authenticated
USING (
  status = ANY (ARRAY[
    'active','new','coming_soon','off_market','back_on_market','price_changed',
    'extended','reactivated','under_agreement','pending','contingent','sold','rented'
  ])
  OR public.matches_current_account(agent_id)
);

REVOKE SELECT ON TABLE public.listings FROM anon;

CREATE OR REPLACE VIEW public.listings_public
WITH (security_invoker = false)
AS
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
FROM public.listings AS l
WHERE public.is_public_listing_status(l.status);

REVOKE ALL ON TABLE public.listings_public FROM PUBLIC;
GRANT SELECT ON TABLE public.listings_public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.listing_row_exists(p_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listings AS l WHERE l.id = p_listing_id
  );
$$;

REVOKE ALL ON FUNCTION public.listing_row_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listing_row_exists(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public can create validated showing requests" ON public.showing_requests;

CREATE POLICY "Public can create validated showing requests"
  ON public.showing_requests FOR INSERT
  TO public
  WITH CHECK (
    length(coalesce(requester_name, '')) BETWEEN 1 AND 120
    AND requester_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND length(requester_email) <= 254
    AND (requester_phone IS NULL OR length(requester_phone) BETWEEN 7 AND 32)
    AND length(coalesce(message, '')) <= 2000
    AND public.listing_row_exists(showing_requests.listing_id)
  );

COMMIT;