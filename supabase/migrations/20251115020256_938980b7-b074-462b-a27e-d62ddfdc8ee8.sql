-- Add virtual_tour_url column to listings table
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS virtual_tour_url TEXT;