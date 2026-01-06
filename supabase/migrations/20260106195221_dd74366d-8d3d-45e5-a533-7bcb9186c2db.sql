-- Add unique constraint on email (case-insensitive) for agent_early_access
CREATE UNIQUE INDEX IF NOT EXISTS agent_early_access_email_unique 
ON public.agent_early_access (LOWER(email));