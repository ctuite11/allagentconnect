-- Evaluate participation inside the view (view owner rights) instead of via a
-- caller-executable function, so anon/authenticated never gain any access to
-- agent_settings and cannot probe participation directly.

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
  AND EXISTS (
    SELECT 1
    FROM public.agent_settings s
    WHERE s.user_id = l.agent_id
      AND s.dcmls_participation IS TRUE
  );

GRANT SELECT ON public.dcmls_listings_public TO anon, authenticated;

-- Participation helper stays internal: only SECURITY DEFINER triggers use it.
REVOKE ALL ON FUNCTION public.agent_dcmls_participating(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_dcmls_participating(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.agent_dcmls_participating(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.agent_dcmls_participating(uuid) TO service_role;