
-- Add status and ended_at columns to client_agent_relationships
ALTER TABLE client_agent_relationships 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ NULL;

-- Add constraint to ensure status is valid
ALTER TABLE client_agent_relationships 
DROP CONSTRAINT IF EXISTS valid_relationship_status;

ALTER TABLE client_agent_relationships 
ADD CONSTRAINT valid_relationship_status 
CHECK (status IN ('active', 'pending', 'declined', 'inactive'));

-- Add index for faster queries on status
CREATE INDEX IF NOT EXISTS idx_client_agent_relationships_status 
ON client_agent_relationships(client_id, status);

-- Add index for faster queries on active relationships
CREATE INDEX IF NOT EXISTS idx_client_agent_relationships_active 
ON client_agent_relationships(client_id, agent_id) 
WHERE status = 'active';

-- Create function to ensure only one active relationship per client
CREATE OR REPLACE FUNCTION check_single_active_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check for active status
  IF NEW.status = 'active' THEN
    -- Check if another active relationship exists for this client
    IF EXISTS (
      SELECT 1 
      FROM client_agent_relationships 
      WHERE client_id = NEW.client_id 
      AND status = 'active' 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Client can only have one active agent relationship at a time';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to enforce single active agent
DROP TRIGGER IF EXISTS enforce_single_active_agent ON client_agent_relationships;
CREATE TRIGGER enforce_single_active_agent
  BEFORE INSERT OR UPDATE ON client_agent_relationships
  FOR EACH ROW
  EXECUTE FUNCTION check_single_active_agent();
