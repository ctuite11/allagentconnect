
CREATE TABLE IF NOT EXISTS public.agent_sent_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  listing_id UUID NOT NULL,
  status_at_send TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_sent_listings_unique UNIQUE (agent_id, listing_id, status_at_send)
);

CREATE INDEX IF NOT EXISTS agent_sent_listings_agent_idx ON public.agent_sent_listings (agent_id);
CREATE INDEX IF NOT EXISTS agent_sent_listings_listing_idx ON public.agent_sent_listings (listing_id);

GRANT SELECT ON public.agent_sent_listings TO authenticated;
GRANT ALL ON public.agent_sent_listings TO service_role;

ALTER TABLE public.agent_sent_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can read their own sent-listing rows"
  ON public.agent_sent_listings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_id);
