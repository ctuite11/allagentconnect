-- Read-only audit: non-draft listings that violate listings_non_draft_requires_pricing_check.
-- Does not mutate data. Run in Supabase SQL editor.

SELECT
  l.id,
  l.listing_number,
  l.address,
  l.city,
  l.state,
  l.listing_type,
  l.status,
  l.price,
  l.price_range_min,
  l.price_range_max,
  -- monthly_rent is not a column; rentals store rent in price
  CASE WHEN l.listing_type = 'for_rent' THEN l.price ELSE NULL END AS monthly_rent,
  l.agent_id,
  trim(both ' ' FROM concat_ws(' ', ap.first_name, ap.last_name)) AS agent_name,
  ap.email AS agent_email
FROM public.listings l
LEFT JOIN public.agent_profiles ap ON ap.id = l.agent_id
WHERE l.status IS DISTINCT FROM 'draft'
  AND (
    (
      l.listing_type = 'for_rent'
      AND COALESCE(l.price, 0) <= 0
    )
    OR (
      COALESCE(l.listing_type, 'for_sale') <> 'for_rent'
      AND COALESCE(l.price, 0) <= 0
      AND (
        COALESCE(l.price_range_min, 0) <= 0
        OR COALESCE(l.price_range_max, 0) <= 0
      )
    )
  )
ORDER BY l.listing_number NULLS LAST, l.updated_at DESC NULLS LAST;

-- Count summary
SELECT count(*) AS invalid_non_draft_count
FROM public.listings l
WHERE l.status IS DISTINCT FROM 'draft'
  AND (
    (
      l.listing_type = 'for_rent'
      AND COALESCE(l.price, 0) <= 0
    )
    OR (
      COALESCE(l.listing_type, 'for_sale') <> 'for_rent'
      AND COALESCE(l.price, 0) <= 0
      AND (
        COALESCE(l.price_range_min, 0) <= 0
        OR COALESCE(l.price_range_max, 0) <= 0
      )
    )
  );

-- Is L-1232 included?
SELECT
  l.id,
  l.listing_number,
  l.status,
  l.listing_type,
  l.price,
  l.price_range_min,
  l.price_range_max
FROM public.listings l
WHERE l.listing_number = 'L-1232'
   OR l.listing_number = '1232'
   OR l.listing_number ILIKE '%1232%';
