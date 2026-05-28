ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS office_id text;
CREATE INDEX IF NOT EXISTS idx_clients_agent_office ON public.clients(agent_user_id, office_id);