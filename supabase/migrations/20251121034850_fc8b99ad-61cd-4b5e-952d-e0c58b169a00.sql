-- Drop the existing unique constraint that doesn't include source
ALTER TABLE public.agent_buyer_coverage_areas 
DROP CONSTRAINT IF EXISTS agent_buyer_coverage_areas_agent_id_zip_code_key;

-- Add new unique constraint that includes source
ALTER TABLE public.agent_buyer_coverage_areas 
ADD CONSTRAINT agent_buyer_coverage_areas_agent_id_zip_code_source_key 
UNIQUE (agent_id, zip_code, source);