
CREATE OR REPLACE FUNCTION public.listings_within_radius(
  origin_lat double precision,
  origin_lng double precision,
  radius_miles double precision
)
RETURNS TABLE(listing_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT l.id AS listing_id
  FROM public.listings l
  WHERE l.latitude IS NOT NULL
    AND l.longitude IS NOT NULL
    AND (
      3959 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(origin_lat))
          * cos(radians(l.latitude))
          * cos(radians(l.longitude) - radians(origin_lng))
          + sin(radians(origin_lat))
          * sin(radians(l.latitude))
        ))
      )
    ) <= radius_miles;
$$;
