-- Create a public view exposing only verified agent user_ids
-- This allows the directory to discover verified agents without exposing full agent_settings

CREATE OR REPLACE VIEW public.agent_directory_status
WITH (security_invoker = false) AS
SELECT 
  user_id,
  agent_status
FROM public.agent_settings
WHERE agent_status = 'verified';

-- Grant SELECT to both anonymous and authenticated users
GRANT SELECT ON public.agent_directory_status TO anon;
GRANT SELECT ON public.agent_directory_status TO authenticated;

-- Add a comment for documentation
COMMENT ON VIEW public.agent_directory_status IS 'Public view exposing only verified agent IDs for directory pages. Does not expose other agent_settings columns.';