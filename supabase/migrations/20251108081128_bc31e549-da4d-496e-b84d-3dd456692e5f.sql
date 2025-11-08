-- Create notification preferences table
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_matches_enabled BOOLEAN DEFAULT true,
  price_changes_enabled BOOLEAN DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'immediate', -- immediate, daily, weekly
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create price change tracking table
CREATE TABLE public.favorite_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  favorite_id UUID NOT NULL REFERENCES public.favorites(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP WITH TIME ZONE
);

-- Create hot sheet notifications tracking table
CREATE TABLE public.hot_sheet_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hot_sheet_id UUID NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(hot_sheet_id, listing_id)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hot_sheet_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view their own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for favorite_price_history
CREATE POLICY "Users can view price history for their favorites"
  ON public.favorite_price_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.favorites
    WHERE favorites.id = favorite_price_history.favorite_id
    AND favorites.user_id = auth.uid()
  ));

-- RLS Policies for hot_sheet_notifications
CREATE POLICY "Users can view their own hot sheet notifications"
  ON public.hot_sheet_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Create function to track price changes
CREATE OR REPLACE FUNCTION public.track_favorite_price_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if price actually changed
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    -- Insert price change record for all favorites of this listing
    INSERT INTO public.favorite_price_history (favorite_id, listing_id, old_price, new_price)
    SELECT 
      f.id,
      NEW.id,
      OLD.price,
      NEW.price
    FROM public.favorites f
    WHERE f.listing_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for price change tracking
CREATE TRIGGER track_listing_price_changes
  AFTER UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.track_favorite_price_changes();

-- Create function to check for new matching properties
CREATE OR REPLACE FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id UUID)
RETURNS TABLE(listing_id UUID) AS $$
DECLARE
  v_criteria JSONB;
  v_user_id UUID;
BEGIN
  -- Get hot sheet criteria and user
  SELECT criteria, user_id INTO v_criteria, v_user_id
  FROM public.hot_sheets
  WHERE id = p_hot_sheet_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Find matching active listings that haven't been notified yet
  RETURN QUERY
  SELECT DISTINCT l.id
  FROM public.listings l
  WHERE l.status = 'active'
    -- Check if not already notified
    AND NOT EXISTS (
      SELECT 1 FROM public.hot_sheet_notifications hsn
      WHERE hsn.hot_sheet_id = p_hot_sheet_id
      AND hsn.listing_id = l.id
    )
    -- Check property type
    AND (
      (v_criteria->'propertyTypes')::jsonb IS NULL
      OR l.property_type = ANY(
        SELECT jsonb_array_elements_text(v_criteria->'propertyTypes')
      )
    )
    -- Check state
    AND (
      (v_criteria->>'state') IS NULL
      OR l.state = (v_criteria->>'state')
    )
    -- Check cities
    AND (
      (v_criteria->'cities')::jsonb IS NULL
      OR l.city = ANY(
        SELECT jsonb_array_elements_text(v_criteria->'cities')
      )
    )
    -- Check max price
    AND (
      (v_criteria->>'maxPrice') IS NULL
      OR l.price <= (v_criteria->>'maxPrice')::numeric
    )
    -- Check min price
    AND (
      (v_criteria->>'minPrice') IS NULL
      OR l.price >= (v_criteria->>'minPrice')::numeric
    )
    -- Check bedrooms
    AND (
      (v_criteria->>'bedrooms') IS NULL
      OR l.bedrooms >= (v_criteria->>'bedrooms')::integer
    )
    -- Check bathrooms
    AND (
      (v_criteria->>'bathrooms') IS NULL
      OR l.bathrooms >= (v_criteria->>'bathrooms')::numeric
    )
    -- Only listings created in last 24 hours
    AND l.created_at >= NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create indexes for performance
CREATE INDEX idx_favorite_price_history_favorite_id ON public.favorite_price_history(favorite_id);
CREATE INDEX idx_favorite_price_history_notification_sent ON public.favorite_price_history(notification_sent) WHERE notification_sent = false;
CREATE INDEX idx_hot_sheet_notifications_hot_sheet_id ON public.hot_sheet_notifications(hot_sheet_id);
CREATE INDEX idx_hot_sheet_notifications_listing_id ON public.hot_sheet_notifications(listing_id);
CREATE INDEX idx_hot_sheet_notifications_notification_sent ON public.hot_sheet_notifications(notification_sent) WHERE notification_sent = false;

-- Create updated_at trigger function
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();