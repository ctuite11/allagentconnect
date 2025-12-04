-- Add list_date and expiration_date columns to listings table
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS list_date DATE,
ADD COLUMN IF NOT EXISTS expiration_date DATE;

-- Create listing_price_history table
CREATE TABLE IF NOT EXISTS public.listing_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  old_price NUMERIC,
  new_price NUMERIC NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID,
  note TEXT
);

-- Enable RLS on listing_price_history
ALTER TABLE public.listing_price_history ENABLE ROW LEVEL SECURITY;

-- RLS policy: Agents can view price history for their listings
CREATE POLICY "Agents can view price history for their listings" 
ON public.listing_price_history 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.listings 
  WHERE listings.id = listing_price_history.listing_id 
  AND listings.agent_id = auth.uid()
));

-- RLS policy: System/agents can insert price history
CREATE POLICY "Anyone can insert price history" 
ON public.listing_price_history 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_listing_price_history_listing_id ON public.listing_price_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_price_history_changed_at ON public.listing_price_history(changed_at DESC);