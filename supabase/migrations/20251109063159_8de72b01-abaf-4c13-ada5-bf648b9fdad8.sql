-- Add multi_family_details column to listings table
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS multi_family_details JSONB DEFAULT NULL;