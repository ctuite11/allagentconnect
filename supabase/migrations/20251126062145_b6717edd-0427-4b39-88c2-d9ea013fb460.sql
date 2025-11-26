-- Add new columns for rental features and simplified disclosures
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS storage_options jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS lead_paint jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS handicap_accessible text;