-- Add missing columns to listings table for enhanced property details

-- Listing agreement types (for sale listings)
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS listing_agreement_types jsonb DEFAULT NULL;

-- Special sale conditions
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS entry_only boolean DEFAULT NULL;

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS lender_owned boolean DEFAULT NULL;

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS short_sale boolean DEFAULT NULL;

-- Property style
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS property_styles jsonb DEFAULT NULL;

-- Location features
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS waterfront boolean DEFAULT NULL;

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS water_view boolean DEFAULT NULL;

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS beach_nearby boolean DEFAULT NULL;

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS facing_direction jsonb DEFAULT NULL;

-- Property features
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS num_fireplaces integer DEFAULT NULL;

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS has_basement boolean DEFAULT NULL;

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS garage_spaces integer DEFAULT NULL;

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS total_parking_spaces integer DEFAULT NULL;

-- Construction and exterior
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS construction_features jsonb DEFAULT NULL;

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS roof_materials jsonb DEFAULT NULL;

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS exterior_features_list jsonb DEFAULT NULL;

-- Systems
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS heating_types jsonb DEFAULT NULL;

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS cooling_types jsonb DEFAULT NULL;

-- Green features
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS green_features jsonb DEFAULT NULL;