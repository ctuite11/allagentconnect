-- Add source column to separate profile coverage from notification coverage
ALTER TABLE public.agent_buyer_coverage_areas
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'profile';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_agent_buyer_coverage_source 
  ON public.agent_buyer_coverage_areas(agent_id, source);