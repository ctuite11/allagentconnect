-- Add DCMLS publishing columns to listings table
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS publish_to_dcmls boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dcmls_status text NOT NULL DEFAULT 'not_published',
  ADD COLUMN IF NOT EXISTS dcmls_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS dcmls_last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS dcmls_error text;

-- Add index for DCMLS public queries (fast filter for published listings)
CREATE INDEX IF NOT EXISTS idx_listings_dcmls_published
  ON public.listings (publish_to_dcmls, dcmls_status)
  WHERE publish_to_dcmls = true AND dcmls_status = 'published';