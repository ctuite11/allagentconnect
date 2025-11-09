-- Add condominium details column to listings table
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS condo_details JSONB DEFAULT NULL;

COMMENT ON COLUMN public.listings.condo_details IS 'Stores condominium-specific information including unit number, floor level, HOA fees, building amenities, pet policy, and total units in building';