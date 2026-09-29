ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS buyer_agent_compensation_offered boolean NULL;
COMMENT ON COLUMN public.listings.buyer_agent_compensation_offered IS 'null = unanswered, true = offered, false = explicitly not offered';
ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS dcmls_buyer_lead_zips text[] NULL,
  ADD COLUMN IF NOT EXISTS dcmls_receive_seller_leads boolean NULL,
  ADD COLUMN IF NOT EXISTS dcmls_buyer_incentives text[] NULL,
  ADD COLUMN IF NOT EXISTS dcmls_seller_incentives text[] NULL;