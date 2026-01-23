-- Add hide_from_directory column to agent_settings
ALTER TABLE public.agent_settings 
ADD COLUMN IF NOT EXISTS hide_from_directory BOOLEAN NOT NULL DEFAULT false;

-- Update the get_verified_agent_ids RPC to exclude hidden agents
CREATE OR REPLACE FUNCTION public.get_verified_agent_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id
  FROM public.agent_settings s
  WHERE s.agent_status = 'verified'
    AND s.hide_from_directory = false;
$$;

-- Hide your specific profile
UPDATE public.agent_settings 
SET hide_from_directory = true 
WHERE user_id = '1fc50da1-2664-4931-8cab-64e24dc5ed8c';