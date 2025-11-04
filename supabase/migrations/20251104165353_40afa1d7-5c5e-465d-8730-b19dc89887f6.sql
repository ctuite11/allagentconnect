-- Add open_houses field to listings table to store scheduled open houses
ALTER TABLE public.listings 
ADD COLUMN open_houses jsonb DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.listings.open_houses IS 'Array of scheduled open houses with type (public/broker), date, start_time, end_time, and notes';