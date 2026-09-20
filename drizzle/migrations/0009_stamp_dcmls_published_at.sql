CREATE OR REPLACE FUNCTION public.enforce_listing_dcmls_participation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (COALESCE(NEW.publish_to_dcmls, false) OR COALESCE(NEW.dcmls_status, 'not_published') <> 'not_published')
     AND NOT public.agent_dcmls_participating(NEW.agent_id) THEN
    NEW.publish_to_dcmls := false;
    NEW.dcmls_status := 'not_published';
  END IF;

  -- V1: stamp first publication only; never overwrite or erase.
  IF NEW.publish_to_dcmls = true
     AND NEW.dcmls_status = 'published'
     AND NEW.dcmls_published_at IS NULL THEN
    NEW.dcmls_published_at := now();
  END IF;

  RETURN NEW;
END;
$$;