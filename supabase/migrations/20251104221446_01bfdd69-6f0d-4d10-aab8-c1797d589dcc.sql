-- Fix search_path security issue for generate_aac_id function
ALTER TABLE agent_profiles ALTER COLUMN aac_id DROP DEFAULT;

DROP FUNCTION IF EXISTS generate_aac_id();

CREATE OR REPLACE FUNCTION generate_aac_id()
RETURNS TEXT AS $$
DECLARE
  next_val INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(aac_id FROM 5) AS INTEGER)), 0) + 1
  INTO next_val
  FROM agent_profiles
  WHERE aac_id ~ '^AAC-[0-9]+$';
  
  RETURN 'AAC-' || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE agent_profiles ALTER COLUMN aac_id SET DEFAULT generate_aac_id();