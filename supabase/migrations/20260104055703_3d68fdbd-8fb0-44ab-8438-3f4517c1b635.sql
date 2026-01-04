-- Add team_name column to agent_profiles
ALTER TABLE public.agent_profiles
ADD COLUMN IF NOT EXISTS team_name text;