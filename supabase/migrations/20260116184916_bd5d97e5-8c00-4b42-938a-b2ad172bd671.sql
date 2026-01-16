-- Create a SECURITY DEFINER function to safely expose verified agent IDs
-- This bypasses RLS on agent_settings while only exposing minimal data

CREATE OR REPLACE FUNCTION public.get_verified_agent_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id
  FROM public.agent_settings s
  WHERE s.agent_status = 'verified';
$$;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_verified_agent_ids() TO anon, authenticated;