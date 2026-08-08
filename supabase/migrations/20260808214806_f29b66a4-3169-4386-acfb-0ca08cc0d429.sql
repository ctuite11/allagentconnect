ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS hidden_from_market_activity boolean NOT NULL DEFAULT false;