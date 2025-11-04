-- Add listing_number column to listings table
ALTER TABLE public.listings 
ADD COLUMN listing_number TEXT;

-- Add aac_id column to agent_profiles table
ALTER TABLE public.agent_profiles 
ADD COLUMN aac_id TEXT;

-- Create sequences for auto-incrementing
CREATE SEQUENCE IF NOT EXISTS public.listing_number_seq START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS public.aac_id_seq START WITH 1;

-- Create function to generate listing number
CREATE OR REPLACE FUNCTION public.generate_listing_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('listing_number_seq');
  RETURN 'L-' || next_num;
END;
$$;

-- Create function to generate AAC ID
CREATE OR REPLACE FUNCTION public.generate_aac_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('aac_id_seq');
  RETURN 'AAC-' || next_num;
END;
$$;

-- Assign listing numbers to all existing listings
UPDATE public.listings 
SET listing_number = generate_listing_number()
WHERE listing_number IS NULL;

-- Assign AAC IDs to all existing agents
UPDATE public.agent_profiles 
SET aac_id = generate_aac_id()
WHERE aac_id IS NULL;

-- Make columns non-nullable after assigning values
ALTER TABLE public.listings 
ALTER COLUMN listing_number SET NOT NULL;

ALTER TABLE public.agent_profiles 
ALTER COLUMN aac_id SET NOT NULL;

-- Add unique constraints
ALTER TABLE public.listings 
ADD CONSTRAINT listings_listing_number_unique UNIQUE (listing_number);

ALTER TABLE public.agent_profiles 
ADD CONSTRAINT agent_profiles_aac_id_unique UNIQUE (aac_id);

-- Set defaults for new records
ALTER TABLE public.listings 
ALTER COLUMN listing_number SET DEFAULT generate_listing_number();

ALTER TABLE public.agent_profiles 
ALTER COLUMN aac_id SET DEFAULT generate_aac_id();