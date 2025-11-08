-- Create function to sync hot sheet criteria to client needs
CREATE OR REPLACE FUNCTION sync_hot_sheet_to_client_needs()
RETURNS TRIGGER AS $$
DECLARE
  property_type_val text;
  city_val text;
  state_val text;
  max_price_val numeric;
  bedrooms_val integer;
  bathrooms_val numeric;
  description_val text;
BEGIN
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on hot_sheets
CREATE TRIGGER sync_hot_sheet_to_client_needs_trigger
AFTER INSERT OR UPDATE ON hot_sheets
FOR EACH ROW
EXECUTE FUNCTION sync_hot_sheet_to_client_needs();

-- Also create trigger to delete client needs when hot sheet is deleted
CREATE OR REPLACE FUNCTION delete_hot_sheet_client_needs()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM client_needs
  WHERE submitted_by = OLD.user_id
  AND description LIKE '%hot sheet: ' || OLD.name || '%';
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER delete_hot_sheet_client_needs_trigger
BEFORE DELETE ON hot_sheets
FOR EACH ROW
EXECUTE FUNCTION delete_hot_sheet_client_needs();