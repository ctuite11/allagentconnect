-- Add new columns for enhanced listing details
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS area_amenities text[],
ADD COLUMN IF NOT EXISTS disclosures_other text,
ADD COLUMN IF NOT EXISTS property_website_url text,
ADD COLUMN IF NOT EXISTS video_url text;

-- Add comments for clarity
COMMENT ON COLUMN public.listings.area_amenities IS 'Multi-select list of area amenities near the property';
COMMENT ON COLUMN public.listings.disclosures_other IS 'Additional disclosures not covered by standard options';
COMMENT ON COLUMN public.listings.property_website_url IS 'URL to dedicated property website';
COMMENT ON COLUMN public.listings.video_url IS 'URL to property video (YouTube, etc)';

-- Note: listing_exclusions and virtual_tour_url already exist in the table