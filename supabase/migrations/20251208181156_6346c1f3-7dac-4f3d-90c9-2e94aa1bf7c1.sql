-- Create off_market_views table for tracking agent views of off-market listings
CREATE TABLE public.off_market_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  viewer_agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'direct'
);

-- Enable RLS
ALTER TABLE public.off_market_views ENABLE ROW LEVEL SECURITY;

-- Policies: listing agents can see who viewed their listings
CREATE POLICY "Agents can view views on their listings"
ON public.off_market_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.listings
    WHERE listings.id = off_market_views.listing_id
    AND listings.agent_id = auth.uid()
  )
);

-- Allow agents to record their own views
CREATE POLICY "Agents can record their views"
ON public.off_market_views
FOR INSERT
WITH CHECK (viewer_agent_id = auth.uid());

-- Create index for fast lookups
CREATE INDEX idx_off_market_views_listing_id ON public.off_market_views(listing_id);
CREATE INDEX idx_off_market_views_viewer_agent_id ON public.off_market_views(viewer_agent_id);