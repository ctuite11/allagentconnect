-- Add county column to listings table
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS county TEXT;