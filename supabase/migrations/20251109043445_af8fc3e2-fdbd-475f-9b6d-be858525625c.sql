-- Safely update sync_hot_sheet_to_client_needs to avoid FK violations when corresponding user/profile rows do not exist
CREATE OR REPLACE FUNCTION public.sync_hot_sheet_to_client_needs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  property_type_val text;
  city_val text;
  state_val text;
  max_price_val numeric;
  bedrooms_val integer;
  bathrooms_val numeric;
  description_val text;
  can_insert boolean := false;
BEGIN
  -- Verify that submitted_by (NEW.user_id) exists in a valid referenced table to avoid FK violations
  -- Check profiles
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.user_id) THEN
    can_insert := true;
  END IF;
  -- Check agent_profiles as well (some setups use agent_profiles.id as FK target)
  IF NOT can_insert AND EXISTS (SELECT 1 FROM public.agent_profiles ap WHERE ap.id = NEW.user_id) THEN
    can_insert := true;
  END IF;

  IF NOT can_insert THEN
    RAISE NOTICE 'Skipping client_needs sync for hot sheet %: no matching profile found for user_id %', NEW.id, NEW.user_id;
    RETURN NEW; -- Do not error; just skip sync
  END IF;

  -- Extract values from criteria JSONB
  property_type_val := COALESCE(
    (NEW.criteria->'propertyTypes'->>0)::text,
    'single_family'
  );
  
  -- Get the first city if cities array exists
  city_val := (NEW.criteria->'cities'->>0)::text;
  
  state_val := (NEW.criteria->>'state')::text;
  
  max_price_val := COALESCE(
    (NEW.criteria->>'maxPrice')::numeric,
    999999999
  );
  
  bedrooms_val := (NEW.criteria->>'bedrooms')::integer;
  bathrooms_val := (NEW.criteria->>'bathrooms')::numeric;
  
  -- Build description from criteria
  description_val := 'Auto-generated from hot sheet: ' || NEW.name;
  
  -- Only create/update if we have minimum required data (state or city)
  IF state_val IS NOT NULL OR city_val IS NOT NULL THEN
    -- Check if a client need already exists for this hot sheet
    IF EXISTS (
      SELECT 1 FROM client_needs 
      WHERE submitted_by = NEW.user_id 
      AND description LIKE '%hot sheet: ' || NEW.name || '%'
    ) THEN
      -- Update existing
      UPDATE client_needs
      SET
        property_type = property_type_val::property_type,
        city = city_val,
        state = state_val,
        max_price = max_price_val,
        bedrooms = bedrooms_val,
        bathrooms = bathrooms_val
      WHERE submitted_by = NEW.user_id
      AND description LIKE '%hot sheet: ' || NEW.name || '%';
    ELSE
      -- Insert new client need
      INSERT INTO client_needs (
        submitted_by,
        property_type,
        city,
        state,
        max_price,
        bedrooms,
        bathrooms,
        description
      ) VALUES (
        NEW.user_id,
        property_type_val::property_type,
        city_val,
        state_val,
        max_price_val,
        bedrooms_val,
        bathrooms_val,
        description_val
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN foreign_key_violation THEN
    -- Avoid failing the hot sheet creation due to FK mismatch; log and continue
    RAISE WARNING 'FK violation when syncing hot sheet % to client_needs for user_id %; skipping. Error: %', NEW.id, NEW.user_id, SQLERRM;
    RETURN NEW;
  WHEN OTHERS THEN
    RAISE WARNING 'Unexpected error syncing hot sheet % to client_needs: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;