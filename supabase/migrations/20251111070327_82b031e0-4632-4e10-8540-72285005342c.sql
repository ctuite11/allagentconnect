-- Add neighborhood column to agent_buyer_coverage_areas table
ALTER TABLE public.agent_buyer_coverage_areas 
ADD COLUMN IF NOT EXISTS neighborhood text;

-- Add county column as well for better organization
ALTER TABLE public.agent_buyer_coverage_areas 
ADD COLUMN IF NOT EXISTS county text;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_agent_buyer_coverage_neighborhood 
ON public.agent_buyer_coverage_areas(agent_id, neighborhood, city, state);