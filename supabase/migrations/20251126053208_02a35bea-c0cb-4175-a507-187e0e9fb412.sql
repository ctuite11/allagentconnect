-- Add pet_options column to listings table
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS pet_options jsonb DEFAULT '[]'::jsonb;