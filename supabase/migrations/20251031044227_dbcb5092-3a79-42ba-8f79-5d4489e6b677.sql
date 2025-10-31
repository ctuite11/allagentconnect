-- Create table for tracking which listings have been sent to clients for each hot sheet
CREATE TABLE IF NOT EXISTS public.hot_sheet_sent_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hot_sheet_id UUID NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(hot_sheet_id, listing_id)
);

-- Create table for client favorites on hot sheets
CREATE TABLE IF NOT EXISTS public.hot_sheet_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hot_sheet_id UUID NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(hot_sheet_id, listing_id)
);

-- Create table for client comments on listings
CREATE TABLE IF NOT EXISTS public.hot_sheet_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hot_sheet_id UUID NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add access token to hot_sheets for client access
ALTER TABLE public.hot_sheets
ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.hot_sheet_sent_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hot_sheet_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hot_sheet_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hot_sheet_sent_listings
CREATE POLICY "Agents can view sent listings for their hot sheets"
ON public.hot_sheet_sent_listings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hot_sheets
    WHERE hot_sheets.id = hot_sheet_sent_listings.hot_sheet_id
    AND hot_sheets.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert sent listings"
ON public.hot_sheet_sent_listings FOR INSERT
WITH CHECK (true);

-- RLS Policies for hot_sheet_favorites
CREATE POLICY "Anyone can view favorites"
ON public.hot_sheet_favorites FOR SELECT
USING (true);

CREATE POLICY "Anyone can add favorites"
ON public.hot_sheet_favorites FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can remove favorites"
ON public.hot_sheet_favorites FOR DELETE
USING (true);

-- RLS Policies for hot_sheet_comments
CREATE POLICY "Agents and clients can view comments"
ON public.hot_sheet_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hot_sheets
    WHERE hot_sheets.id = hot_sheet_comments.hot_sheet_id
    AND (hot_sheets.user_id = auth.uid() OR true)
  )
);

CREATE POLICY "Anyone can add comments"
ON public.hot_sheet_comments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update their comments"
ON public.hot_sheet_comments FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete their comments"
ON public.hot_sheet_comments FOR DELETE
USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hot_sheet_sent_listings_hot_sheet ON public.hot_sheet_sent_listings(hot_sheet_id);
CREATE INDEX IF NOT EXISTS idx_hot_sheet_sent_listings_listing ON public.hot_sheet_sent_listings(listing_id);
CREATE INDEX IF NOT EXISTS idx_hot_sheet_favorites_hot_sheet ON public.hot_sheet_favorites(hot_sheet_id);
CREATE INDEX IF NOT EXISTS idx_hot_sheet_comments_hot_sheet ON public.hot_sheet_comments(hot_sheet_id);
CREATE INDEX IF NOT EXISTS idx_hot_sheets_access_token ON public.hot_sheets(access_token);

-- Trigger to update updated_at
CREATE TRIGGER update_hot_sheet_comments_updated_at
BEFORE UPDATE ON public.hot_sheet_comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();