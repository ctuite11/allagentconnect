-- Add public_records_cache table for caching ATTOM data
CREATE TABLE IF NOT EXISTS public.public_records_cache (
  attom_id text PRIMARY KEY,
  raw jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.public_records_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view cached records
CREATE POLICY "Anyone can view public records cache"
  ON public.public_records_cache
  FOR SELECT
  USING (true);

-- Policy: System can insert records
CREATE POLICY "System can insert public records cache"
  ON public.public_records_cache
  FOR INSERT
  WITH CHECK (true);

-- Add attom_id column to listings table if it doesn't exist
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS attom_id text;