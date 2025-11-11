-- Create table for agent buyer coverage areas (zip codes)
CREATE TABLE IF NOT EXISTS public.agent_buyer_coverage_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  zip_code TEXT NOT NULL,
  city TEXT,
  state TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(agent_id, zip_code)
);

-- Enable RLS
ALTER TABLE public.agent_buyer_coverage_areas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Agents can view their own coverage areas"
  ON public.agent_buyer_coverage_areas
  FOR SELECT
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents can insert their own coverage areas"
  ON public.agent_buyer_coverage_areas
  FOR INSERT
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can delete their own coverage areas"
  ON public.agent_buyer_coverage_areas
  FOR DELETE
  USING (auth.uid() = agent_id);

CREATE POLICY "Anyone can view coverage areas"
  ON public.agent_buyer_coverage_areas
  FOR SELECT
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_buyer_coverage_zip ON public.agent_buyer_coverage_areas(zip_code);
CREATE INDEX IF NOT EXISTS idx_agent_buyer_coverage_agent ON public.agent_buyer_coverage_areas(agent_id);