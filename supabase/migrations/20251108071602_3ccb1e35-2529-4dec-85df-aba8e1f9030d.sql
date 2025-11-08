-- Create listing_stats table to track engagement metrics
CREATE TABLE IF NOT EXISTS public.listing_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  view_count INTEGER NOT NULL DEFAULT 0,
  save_count INTEGER NOT NULL DEFAULT 0,
  contact_count INTEGER NOT NULL DEFAULT 0,
  showing_request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(listing_id)
);

-- Enable RLS
ALTER TABLE public.listing_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can view listing stats
CREATE POLICY "Anyone can view listing stats"
  ON public.listing_stats
  FOR SELECT
  USING (true);

-- System can insert and update stats
CREATE POLICY "System can manage listing stats"
  ON public.listing_stats
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_listing_stats_listing_id ON public.listing_stats(listing_id);

-- Function to initialize stats for a new listing
CREATE OR REPLACE FUNCTION public.initialize_listing_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.listing_stats (listing_id)
  VALUES (NEW.id)
  ON CONFLICT (listing_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to initialize stats when listing is created
CREATE TRIGGER on_listing_created_init_stats
  AFTER INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_listing_stats();

-- Function to update save count when favorite is added/removed
CREATE OR REPLACE FUNCTION public.update_listing_save_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.listing_stats
    SET save_count = save_count + 1,
        updated_at = now()
    WHERE listing_id = NEW.listing_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.listing_stats
    SET save_count = GREATEST(save_count - 1, 0),
        updated_at = now()
    WHERE listing_id = OLD.listing_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger for favorites
CREATE TRIGGER on_favorite_change_update_stats
  AFTER INSERT OR DELETE ON public.favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_listing_save_count();

-- Function to update contact count when message is sent
CREATE OR REPLACE FUNCTION public.update_listing_contact_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.listing_stats
  SET contact_count = contact_count + 1,
      updated_at = now()
  WHERE listing_id = NEW.listing_id;
  RETURN NEW;
END;
$$;

-- Trigger for messages
CREATE TRIGGER on_message_sent_update_stats
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_listing_contact_count();

-- Function to update showing request count
CREATE OR REPLACE FUNCTION public.update_listing_showing_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.listing_stats
  SET showing_request_count = showing_request_count + 1,
      updated_at = now()
  WHERE listing_id = NEW.listing_id;
  RETURN NEW;
END;
$$;

-- Trigger for showing requests
CREATE TRIGGER on_showing_request_update_stats
  AFTER INSERT ON public.showing_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_listing_showing_count();

-- Create listing_views table for tracking individual views
CREATE TABLE IF NOT EXISTS public.listing_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewer_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert views
CREATE POLICY "Anyone can record views"
  ON public.listing_views
  FOR INSERT
  WITH CHECK (true);

-- Agents can view stats for their listings
CREATE POLICY "Agents can view their listing views"
  ON public.listing_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_views.listing_id
      AND listings.agent_id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_listing_views_listing_id ON public.listing_views(listing_id);
CREATE INDEX idx_listing_views_created_at ON public.listing_views(created_at);

-- Function to update view count
CREATE OR REPLACE FUNCTION public.update_listing_view_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.listing_stats
  SET view_count = view_count + 1,
      updated_at = now()
  WHERE listing_id = NEW.listing_id;
  RETURN NEW;
END;
$$;

-- Trigger for views
CREATE TRIGGER on_listing_viewed_update_stats
  AFTER INSERT ON public.listing_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_listing_view_count();

-- Initialize stats for existing listings
INSERT INTO public.listing_stats (listing_id, save_count, contact_count, showing_request_count)
SELECT 
  l.id,
  COALESCE((SELECT COUNT(*) FROM public.favorites WHERE listing_id = l.id), 0),
  COALESCE((SELECT COUNT(*) FROM public.agent_messages WHERE listing_id = l.id), 0),
  COALESCE((SELECT COUNT(*) FROM public.showing_requests WHERE listing_id = l.id), 0)
FROM public.listings l
ON CONFLICT (listing_id) DO UPDATE
SET 
  save_count = EXCLUDED.save_count,
  contact_count = EXCLUDED.contact_count,
  showing_request_count = EXCLUDED.showing_request_count;