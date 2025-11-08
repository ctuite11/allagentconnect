-- Add fields to track relisting information
ALTER TABLE public.listings
ADD COLUMN original_listing_id uuid REFERENCES public.listings(id),
ADD COLUMN is_relisting boolean DEFAULT false,
ADD COLUMN cancelled_at timestamp with time zone;

-- Create function to check if listing is a relisting within 30 days
CREATE OR REPLACE FUNCTION public.check_and_link_relisting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  previous_listing RECORD;
  days_since_cancelled integer;
BEGIN
  -- Only check for new listings that are active
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    -- Look for previous cancelled/withdrawn listings at the same address by any agent
    SELECT 
      l.id,
      l.agent_id,
      l.cancelled_at,
      l.created_at,
      COALESCE(l.original_listing_id, l.id) as root_listing_id
    INTO previous_listing
    FROM public.listings l
    WHERE l.address = NEW.address
      AND l.city = NEW.city
      AND l.state = NEW.state
      AND l.zip_code = NEW.zip_code
      AND l.id != NEW.id
      AND l.status IN ('cancelled', 'withdrawn', 'temporarily_withdrawn')
    ORDER BY 
      COALESCE(l.cancelled_at, l.updated_at) DESC
    LIMIT 1;

    IF previous_listing.id IS NOT NULL THEN
      days_since_cancelled := CEIL(EXTRACT(EPOCH FROM (NEW.created_at - COALESCE(previous_listing.cancelled_at, previous_listing.created_at))) / 86400);
      
      -- If relisted within 30 days
      IF days_since_cancelled <= 30 THEN
        -- Same agent: Link to original and preserve history
        IF previous_listing.agent_id = NEW.agent_id THEN
          NEW.is_relisting := true;
          NEW.original_listing_id := previous_listing.root_listing_id;
          
          -- Copy status history from previous listing to new listing
          INSERT INTO public.listing_status_history (listing_id, old_status, new_status, changed_at, changed_by, notes)
          SELECT 
            NEW.id,
            old_status,
            new_status,
            changed_at,
            changed_by,
            'Migrated from previous listing due to relisting within 30 days'
          FROM public.listing_status_history
          WHERE listing_id = previous_listing.id
          ORDER BY changed_at ASC;
          
        -- Different agent within 30 days: Treat as new listing
        ELSE
          NEW.is_relisting := false;
          NEW.original_listing_id := NULL;
        END IF;
      -- After 30 days with same agent: Treat as new listing
      ELSE
        NEW.is_relisting := false;
        NEW.original_listing_id := NULL;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to check for relistings on insert
CREATE TRIGGER on_listing_created_check_relisting
  BEFORE INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_link_relisting();

-- Update listings to set cancelled_at when status changes to cancelled/withdrawn
CREATE OR REPLACE FUNCTION public.set_cancelled_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Set cancelled_at when status changes to cancelled, withdrawn, or temporarily_withdrawn
  IF NEW.status IN ('cancelled', 'withdrawn', 'temporarily_withdrawn') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('cancelled', 'withdrawn', 'temporarily_withdrawn')) THEN
    NEW.cancelled_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to set cancelled date
CREATE TRIGGER on_listing_cancelled_set_date
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cancelled_date();

-- Add index for faster relisting lookups
CREATE INDEX idx_listings_address_status ON public.listings(address, city, state, zip_code, status);