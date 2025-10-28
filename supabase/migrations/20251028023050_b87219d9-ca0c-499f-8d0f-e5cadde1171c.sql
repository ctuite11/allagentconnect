-- Create listings table
CREATE TABLE public.listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Address information
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  
  -- Property details from Attom
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms NUMERIC,
  square_feet INTEGER,
  lot_size NUMERIC,
  year_built INTEGER,
  
  -- Listing details
  price NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  description TEXT,
  
  -- Attom data (stored as JSON)
  attom_data JSONB,
  
  -- Other APIs data
  walk_score_data JSONB,
  schools_data JSONB,
  value_estimate JSONB
);

-- Enable RLS
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view active listings"
  ON public.listings
  FOR SELECT
  USING (status = 'active' OR auth.uid() = agent_id);

CREATE POLICY "Agents can insert their own listings"
  ON public.listings
  FOR INSERT
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can update their own listings"
  ON public.listings
  FOR UPDATE
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents can delete their own listings"
  ON public.listings
  FOR DELETE
  USING (auth.uid() = agent_id);

-- Create index for better query performance
CREATE INDEX idx_listings_agent_id ON public.listings(agent_id);
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_location ON public.listings(city, state, zip_code);

-- Trigger for updated_at
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();