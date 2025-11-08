-- Create function to notify matching buyers when a new listing is added
CREATE OR REPLACE FUNCTION notify_matching_buyers_on_new_listing()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  -- Only process active listings
  IF NEW.status = 'active' THEN
    -- Use pg_net to make async HTTP request to edge function
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/notify-matching-buyers',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := jsonb_build_object(
        'listing_id', NEW.id::text,
        'address', NEW.address,
        'city', NEW.city,
        'state', NEW.state,
        'price', NEW.price,
        'property_type', NEW.property_type,
        'bedrooms', NEW.bedrooms,
        'bathrooms', NEW.bathrooms,
        'square_feet', NEW.square_feet
      )
    ) INTO request_id;
    
    RAISE LOG 'Triggered buyer notification for listing % with request_id %', NEW.id, request_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to trigger buyer notification for listing %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on listings table
CREATE TRIGGER notify_matching_buyers_trigger
AFTER INSERT ON listings
FOR EACH ROW
EXECUTE FUNCTION notify_matching_buyers_on_new_listing();