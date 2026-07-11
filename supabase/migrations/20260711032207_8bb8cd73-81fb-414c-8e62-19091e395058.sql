
CREATE TABLE IF NOT EXISTS public.agent_sent_client_needs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  client_need_id UUID NOT NULL,
  reason TEXT NOT NULL DEFAULT 'preferences_match',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, client_need_id)
);
GRANT SELECT ON public.agent_sent_client_needs TO authenticated;
GRANT ALL ON public.agent_sent_client_needs TO service_role;
ALTER TABLE public.agent_sent_client_needs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can read their own client-need sends"
  ON public.agent_sent_client_needs FOR SELECT
  TO authenticated USING (auth.uid() = agent_id);

CREATE TABLE IF NOT EXISTS public.agent_sent_broadcasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  broadcast_id UUID NOT NULL,
  reason TEXT NOT NULL DEFAULT 'preferences_match',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, broadcast_id)
);
GRANT SELECT ON public.agent_sent_broadcasts TO authenticated;
GRANT ALL ON public.agent_sent_broadcasts TO service_role;
ALTER TABLE public.agent_sent_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can read their own broadcast sends"
  ON public.agent_sent_broadcasts FOR SELECT
  TO authenticated USING (auth.uid() = agent_id);
