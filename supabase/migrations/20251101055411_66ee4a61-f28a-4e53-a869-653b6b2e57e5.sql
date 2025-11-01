-- Update agent_profiles RLS policies to allow public viewing
DROP POLICY IF EXISTS "Agents can view their own profile" ON public.agent_profiles;
CREATE POLICY "Anyone can view agent profiles" 
ON public.agent_profiles 
FOR SELECT 
USING (true);

-- Update agent_county_preferences RLS policies to allow public viewing
DROP POLICY IF EXISTS "Agents can view their own county preferences" ON public.agent_county_preferences;
CREATE POLICY "Anyone can view agent county preferences" 
ON public.agent_county_preferences 
FOR SELECT 
USING (true);