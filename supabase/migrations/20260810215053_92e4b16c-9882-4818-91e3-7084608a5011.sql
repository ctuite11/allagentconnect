-- Phase 1: additive safe public read paths for shared listings.
-- No existing policies or grants are modified.

CREATE OR REPLACE FUNCTION public.is_public_listing_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_status = ANY (ARRAY[
    'active','new','coming_soon','off_market','back_on_market','price_changed',
    'extended','reactivated','under_agreement','pending','contingent','sold','rented'
  ]);
$$;

REVOKE ALL ON FUNCTION public.is_public_listing_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_listing_status(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_listing(p_listing_id uuid)
RETURNS TABLE (
  id uuid,
  listing_number text,
  status text,
  listing_type text,
  property_type text,
  address text,
  unit_number text,
  building_name text,
  city text,
  town text,
  state text,
  zip_code text,
  county text,
  neighborhood text,
  latitude numeric,
  longitude numeric,
  price numeric,
  price_range_min numeric,
  price_range_max numeric,
  rental_fee numeric,
  rental_fee_text text,
  bedrooms integer,
  bathrooms numeric,
  square_feet integer,
  lot_size numeric,
  year_built integer,
  floors numeric,
  garage_spaces integer,
  total_parking_spaces integer,
  parking_spaces integer,
  num_fireplaces integer,
  has_basement boolean,
  waterfront boolean,
  water_view boolean,
  water_view_type text,
  beach_nearby boolean,
  handicap_access text,
  handicap_accessible text,
  description text,
  photos jsonb,
  floor_plans jsonb,
  virtual_tour_url text,
  video_url text,
  property_website_url text,
  property_features jsonb,
  amenities jsonb,
  property_styles jsonb,
  construction_features jsonb,
  roof_materials jsonb,
  exterior_features_list jsonb,
  heating_types jsonb,
  cooling_types jsonb,
  green_features jsonb,
  foundation_types jsonb,
  basement_types jsonb,
  basement_features_list jsonb,
  basement_floor_types jsonb,
  parking_features_list jsonb,
  garage_features_list jsonb,
  garage_additional_features_list jsonb,
  outdoor_space jsonb,
  has_storage boolean,
  storage_options jsonb,
  laundry_type text,
  pet_options jsonb,
  pets_comment text,
  area_amenities text[],
  condo_details jsonb,
  multi_family_details jsonb,
  commercial_details jsonb,
  open_houses jsonb,
  appointment_required boolean,
  entry_only boolean,
  lender_owned boolean,
  short_sale boolean,
  annual_property_tax numeric,
  tax_year integer,
  list_date date,
  activation_date date,
  active_date timestamptz,
  go_live_date date,
  created_at timestamptz,
  updated_at timestamptz,
  publish_to_dcmls boolean,
  dcmls_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    l.id,
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
  WHERE l.id = p_listing_id
    AND public.is_public_listing_status(l.status);
$$;

REVOKE ALL ON FUNCTION public.get_public_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_listing(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_listing_agent(p_listing_id uuid)
RETURNS TABLE (
  agent_id uuid,
  aac_id text,
  first_name text,
  last_name text,
  title text,
  company text,
  office_name text,
  office_city text,
  office_state text,
  headshot_url text,
  logo_url text,
  phone text,
  office_phone text,
  cell_phone text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    ap.id AS agent_id,
    ap.aac_id,
    ap.first_name,
    ap.last_name,
    ap.title,
    ap.company,
    ap.office_name,
    ap.office_city,
    ap.office_state,
    ap.headshot_url,
    ap.logo_url,
    ap.phone,
    ap.office_phone,
    ap.cell_phone,
    ap.email
  FROM public.listings AS l
  JOIN public.agent_profiles AS ap ON ap.id = l.agent_id
  WHERE l.id = p_listing_id
    AND public.is_public_listing_status(l.status);
$$;

REVOKE ALL ON FUNCTION public.get_public_listing_agent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_listing_agent(uuid) TO anon, authenticated, service_role;