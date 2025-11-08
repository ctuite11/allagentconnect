-- Add active_date column to listings table
ALTER TABLE public.listings
ADD COLUMN active_date timestamp with time zone;

-- Create function to set active_date when status changes to active
CREATE OR REPLACE FUNCTION public.set_listing_active_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If status is being changed to active and active_date is not yet set
  IF NEW.status = 'active' AND OLD.status != 'active' AND NEW.active_date IS NULL THEN
    NEW.active_date = now();
  END IF;
  
  -- If status is being changed away from active, keep the active_date
  -- (this preserves the original active date for historical purposes)
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically set active_date
CREATE TRIGGER on_listing_status_active
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_listing_active_date();

-- Backfill active_date for existing active listings (use created_at as fallback)
UPDATE public.listings
SET active_date = created_at
WHERE status = 'active' AND active_date IS NULL;