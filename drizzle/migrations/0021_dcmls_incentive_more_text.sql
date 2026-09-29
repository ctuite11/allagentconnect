ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS dcmls_buyer_incentives_more text NULL,
  ADD COLUMN IF NOT EXISTS dcmls_seller_incentives_more text NULL;