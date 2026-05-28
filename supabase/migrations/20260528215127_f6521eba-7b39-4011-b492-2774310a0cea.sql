CREATE UNIQUE INDEX IF NOT EXISTS clients_agent_email_unique
ON public.clients (agent_id, lower(email))
WHERE email IS NOT NULL;