CREATE INDEX IF NOT EXISTS idx_clients_agent_created_id
  ON public.clients (agent_id, created_at DESC, id DESC);