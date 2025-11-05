-- Add title column to agent_profiles table
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS title text;