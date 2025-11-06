-- Create a function to trigger property data fetch after listing insert/update
CREATE OR REPLACE FUNCTION trigger_property_data_fetch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  -- Only trigger if the listing has address data
  IF NEW.address IS NOT NULL AND NEW.city IS NOT NULL AND NEW.state IS NOT NULL THEN
    -- Use pg_net to make async HTTP request to edge function
    -- Note: The service role key will be available in the edge function environment
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/auto-fetch-property-data',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', current_setting('supabase.service_role_key', true)
      ),
      body := jsonb_build_object('listing_id', NEW.id::text)
    ) INTO request_id;
    
    RAISE LOG 'Triggered property data fetch for listing % with request_id %', NEW.id, request_id;
  ELSE
    RAISE LOG 'Skipped property data fetch for listing % - missing address data', NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert/update
    RAISE WARNING 'Failed to trigger property data fetch for listing %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_listing_change_fetch_data ON public.listings;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER on_listing_change_fetch_data
  AFTER INSERT OR UPDATE OF address, city, state, zip_code
  ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_property_data_fetch();

COMMENT ON FUNCTION trigger_property_data_fetch() IS 'Automatically calls edge function to fetch property data from ATTOM API when a listing is created or address is updated';
COMMENT ON TRIGGER on_listing_change_fetch_data ON public.listings IS 'Triggers automatic property data fetch on listing creation or address update';