-- Add city, state, and zip fields to agent_profiles table
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS office_city text,
ADD COLUMN IF NOT EXISTS office_state text,
ADD COLUMN IF NOT EXISTS office_zip text;