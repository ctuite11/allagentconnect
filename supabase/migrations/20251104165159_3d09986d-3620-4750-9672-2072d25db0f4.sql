-- Add activation_date field to listings table
ALTER TABLE public.listings 
ADD COLUMN activation_date date;

-- Add comment for clarity
COMMENT ON COLUMN public.listings.activation_date IS 'Date when a coming_soon listing should automatically become active';

-- Create a function to auto-activate listings
CREATE OR REPLACE FUNCTION public.auto_activate_listings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.listings
  SET status = 'active'
  WHERE status = 'coming_soon'
    AND activation_date IS NOT NULL
    AND activation_date <= CURRENT_DATE;
END;
$$;