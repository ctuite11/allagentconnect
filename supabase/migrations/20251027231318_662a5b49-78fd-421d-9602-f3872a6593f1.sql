-- Create enum for property types
CREATE TYPE property_type AS ENUM ('single_family', 'condo', 'townhouse', 'multi_family', 'land', 'commercial');

-- Create counties table
CREATE TABLE public.counties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'MA',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create agent profiles table
CREATE TABLE public.agent_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  receive_buyer_alerts BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create agent county preferences table
CREATE TABLE public.agent_county_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  county_id UUID NOT NULL REFERENCES public.counties(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(agent_id, county_id)
);

-- Create buyer needs table
CREATE TABLE public.buyer_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  property_type property_type NOT NULL,
  county_id UUID NOT NULL REFERENCES public.counties(id) ON DELETE CASCADE,
  max_price NUMERIC(12, 2) NOT NULL,
  bedrooms INTEGER,
  bathrooms NUMERIC(3, 1),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_county_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_needs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for counties (public read)
CREATE POLICY "Counties are viewable by everyone"
  ON public.counties FOR SELECT
  USING (true);

-- RLS Policies for agent_profiles
CREATE POLICY "Agents can view their own profile"
  ON public.agent_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Agents can update their own profile"
  ON public.agent_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Agents can insert their own profile"
  ON public.agent_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for agent_county_preferences
CREATE POLICY "Agents can view their own county preferences"
  ON public.agent_county_preferences FOR SELECT
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents can insert their own county preferences"
  ON public.agent_county_preferences FOR INSERT
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can delete their own county preferences"
  ON public.agent_county_preferences FOR DELETE
  USING (auth.uid() = agent_id);

-- RLS Policies for buyer_needs
CREATE POLICY "Authenticated users can view buyer needs"
  ON public.buyer_needs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agents can insert buyer needs"
  ON public.buyer_needs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

-- Insert some default Massachusetts counties
INSERT INTO public.counties (name, state) VALUES
  ('Suffolk', 'MA'),
  ('Norfolk', 'MA'),
  ('Middlesex', 'MA'),
  ('Essex', 'MA'),
  ('Worcester', 'MA'),
  ('Plymouth', 'MA'),
  ('Bristol', 'MA'),
  ('Hampden', 'MA'),
  ('Barnstable', 'MA'),
  ('Hampshire', 'MA');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for agent_profiles updated_at
CREATE TRIGGER agent_profiles_updated_at
  BEFORE UPDATE ON public.agent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();