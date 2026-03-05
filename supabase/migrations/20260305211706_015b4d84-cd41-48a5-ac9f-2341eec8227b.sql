
-- Add preview_token to hot_sheet_subscribers for shareable read-only links
ALTER TABLE public.hot_sheet_subscribers
ADD COLUMN IF NOT EXISTS preview_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex');

-- Index for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_hss_preview_token
ON public.hot_sheet_subscribers (preview_token);
