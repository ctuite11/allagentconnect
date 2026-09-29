ALTER TABLE public.agent_settings ADD COLUMN IF NOT EXISTS dcmls_seller_lead_zips text[] NULL;

CREATE TABLE public.dcmls_incentive_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL,
  incentive_type text NOT NULL CHECK (incentive_type IN ('buyer','seller')),
  consumer_name text NOT NULL CHECK (char_length(consumer_name) BETWEEN 1 AND 100),
  consumer_email text NOT NULL CHECK (char_length(consumer_email) BETWEEN 3 AND 255),
  source_zip text NULL CHECK (source_zip IS NULL OR source_zip ~ '^\d{5}$'),
  source_listing_id uuid NULL,
  incentive_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dcmls_incentive_leads_agent ON public.dcmls_incentive_leads (agent_user_id, created_at DESC);

GRANT SELECT ON public.dcmls_incentive_leads TO authenticated;
GRANT ALL ON public.dcmls_incentive_leads TO service_role;

ALTER TABLE public.dcmls_incentive_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents view own DCMLS incentive leads"
ON public.dcmls_incentive_leads
FOR SELECT
TO authenticated
USING (agent_user_id = auth.uid());