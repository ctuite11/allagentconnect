
-- 1. Add normalized address column
ALTER TABLE listings ADD COLUMN IF NOT EXISTS address_normalized TEXT;

-- 2. Backfill existing rows
UPDATE listings
SET address_normalized = lower(trim(regexp_replace(address, '\s+', ' ', 'g')))
WHERE address_normalized IS NULL AND address IS NOT NULL;

-- 3. Normalization trigger function
CREATE OR REPLACE FUNCTION public.normalize_listing_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.address IS NOT NULL THEN
    NEW.address_normalized := lower(trim(regexp_replace(NEW.address, '\s+', ' ', 'g')));
  ELSE
    NEW.address_normalized := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS normalize_listing_address_trigger ON listings;
CREATE TRIGGER normalize_listing_address_trigger
BEFORE INSERT OR UPDATE ON listings
FOR EACH ROW
EXECUTE FUNCTION normalize_listing_address();

-- 4. Partial unique index (only live statuses)
CREATE UNIQUE INDEX IF NOT EXISTS listings_unique_live_address
ON listings (address_normalized, city, state, zip_code)
WHERE status IN (
  'active','new','coming_soon','off_market','back_on_market',
  'price_changed','extended','reactivated','under_agreement',
  'pending','contingent'
);
