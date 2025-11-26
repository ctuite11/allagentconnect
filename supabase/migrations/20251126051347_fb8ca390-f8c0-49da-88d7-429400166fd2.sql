-- Add new fields for rental details and apartment listings

-- Add unit_number field for condos/apartments
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS unit_number text;

-- Add building/complex name field
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS building_name text;

-- Add rental fee (commission) field
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS rental_fee numeric;

-- Add deposit requirements as JSONB array
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS deposit_requirements jsonb DEFAULT '[]'::jsonb;

-- Add outdoor space options as JSONB array
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS outdoor_space jsonb DEFAULT '[]'::jsonb;

-- Add storage availability boolean
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS has_storage boolean DEFAULT false;

-- Add laundry type field
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS laundry_type text;

-- Add pets comment field
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS pets_comment text;

-- Add comment for documentation
COMMENT ON COLUMN listings.unit_number IS 'Unit number for condos and apartments';
COMMENT ON COLUMN listings.building_name IS 'Building or complex name';
COMMENT ON COLUMN listings.rental_fee IS 'Rental commission fee (flat amount)';
COMMENT ON COLUMN listings.deposit_requirements IS 'Array of deposit requirement types (first_month, last_month, security_deposit, etc.)';
COMMENT ON COLUMN listings.outdoor_space IS 'Array of outdoor space options (private, deck, balcony, etc.)';
COMMENT ON COLUMN listings.has_storage IS 'Whether storage is available';
COMMENT ON COLUMN listings.laundry_type IS 'Laundry options: none, in_unit, in_building, hookups';
COMMENT ON COLUMN listings.pets_comment IS 'Free text for pet policies and restrictions';