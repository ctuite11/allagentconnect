-- Change the default value for agent_status from 'unverified' to 'pending'
ALTER TABLE public.agent_settings 
ALTER COLUMN agent_status SET DEFAULT 'pending'::agent_status;