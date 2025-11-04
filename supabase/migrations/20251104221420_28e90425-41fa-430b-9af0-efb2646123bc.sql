-- Update AAC ID generation to start at 0001
-- First, alter the column to remove the default
ALTER TABLE agent_profiles ALTER COLUMN aac_id DROP DEFAULT;

-- Drop and recreate the function
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
$$ LANGUAGE plpgsql;

-- Restore the default
ALTER TABLE agent_profiles ALTER COLUMN aac_id SET DEFAULT generate_aac_id();

-- Update existing AAC IDs to use 4-digit format
UPDATE agent_profiles
SET aac_id = 'AAC-' || LPAD(CAST(SUBSTRING(aac_id FROM 5) AS TEXT), 4, '0')
WHERE aac_id ~ '^AAC-[0-9]+$';