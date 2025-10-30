-- Create favorites/wishlist table
CREATE TABLE public.favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

-- Enable RLS on favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Create policies for favorites
CREATE POLICY "Users can view their own favorites"
  ON public.favorites
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites"
  ON public.favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favorites"
  ON public.favorites
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create hot sheets (saved searches) table
CREATE TABLE public.hot_sheets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on hot_sheets
ALTER TABLE public.hot_sheets ENABLE ROW LEVEL SECURITY;

-- Create policies for hot_sheets
CREATE POLICY "Users can view their own hot sheets"
  ON public.hot_sheets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own hot sheets"
  ON public.hot_sheets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hot sheets"
  ON public.hot_sheets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hot sheets"
  ON public.hot_sheets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for hot_sheets updated_at
CREATE TRIGGER update_hot_sheets_updated_at
  BEFORE UPDATE ON public.hot_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster queries
CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX idx_favorites_listing_id ON public.favorites(listing_id);
CREATE INDEX idx_hot_sheets_user_id ON public.hot_sheets(user_id);
CREATE INDEX idx_hot_sheets_is_active ON public.hot_sheets(is_active);