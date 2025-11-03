-- Add property tax information columns to listings table
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS annual_property_tax numeric,
ADD COLUMN IF NOT EXISTS tax_year integer,
ADD COLUMN IF NOT EXISTS tax_assessment_value numeric;