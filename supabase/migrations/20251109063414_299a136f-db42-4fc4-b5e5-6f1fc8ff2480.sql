-- Add commercial_details column to listings table
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS commercial_details JSONB DEFAULT NULL;