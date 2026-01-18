-- Agent Match: Seller property submissions for matching with AAC Verified buyer agents
-- ============================================================================

-- Create table for seller property submissions
CREATE TABLE public.agent_match_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Seller info (linked after account creation)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_email TEXT NOT NULL,
  seller_name TEXT,
  seller_phone TEXT,
  
  -- Property address
  address TEXT NOT NULL,
  unit_number TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT,
  neighborhood TEXT,
  
  -- Property details
  property_type TEXT NOT NULL,
  bedrooms INTEGER NOT NULL,
  bathrooms NUMERIC(3,1) NOT NULL,
  square_feet INTEGER NOT NULL,
  asking_price NUMERIC(12,2) NOT NULL,
  lot_size NUMERIC(10,2),
  year_built INTEGER,
  description TEXT,
  
  -- Media
  photos TEXT[] DEFAULT '{}',
  floor_plan_urls TEXT[] DEFAULT '{}',
  video_url TEXT,
  property_website_url TEXT,
  
  -- Compensation
  buyer_agent_commission TEXT, -- e.g., "2.5%" or "$10,000"
  
  -- Confirmations
  confirmed_not_under_contract BOOLEAN NOT NULL DEFAULT false,
  confirmed_owner_or_authorized BOOLEAN NOT NULL DEFAULT false,
  
  -- Match results
  match_count INTEGER,
  matched_at TIMESTAMPTZ,
  
  -- Payment/delivery status
  status TEXT NOT NULL DEFAULT 'draft', -- draft, matched, terms_accepted, paid, delivered, expired
  delivery_fee_cents INTEGER DEFAULT 2999, -- $29.99
  payment_completed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add updated_at trigger
CREATE TRIGGER update_agent_match_submissions_updated_at
  BEFORE UPDATE ON public.agent_match_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.agent_match_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Sellers can view and update their own submissions
CREATE POLICY "Users can view their own submissions"
  ON public.agent_match_submissions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own submissions"
  ON public.agent_match_submissions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Anyone can insert (will be linked to account later)
CREATE POLICY "Anyone can create submissions"
  ON public.agent_match_submissions
  FOR INSERT
  WITH CHECK (true);

-- Junction table: which agents received a submission
CREATE TABLE public.agent_match_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.agent_match_submissions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hot_sheet_id UUID REFERENCES public.hot_sheets(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id, agent_id)
);

ALTER TABLE public.agent_match_deliveries ENABLE ROW LEVEL SECURITY;

-- Agents can view deliveries sent to them
CREATE POLICY "Agents can view their deliveries"
  ON public.agent_match_deliveries
  FOR SELECT
  USING (auth.uid() = agent_id);

-- System insert (via service role or edge function)
CREATE POLICY "System can insert deliveries"
  ON public.agent_match_deliveries
  FOR INSERT
  WITH CHECK (true);

-- Create RPC function to count matching agents
-- This counts AAC Verified agents with active hot sheets matching the property
CREATE OR REPLACE FUNCTION public.count_matching_agents(
  p_city TEXT,
  p_state TEXT,
  p_property_type TEXT,
  p_price NUMERIC,
  p_bedrooms INTEGER,
  p_bathrooms NUMERIC
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT hs.user_id)
  INTO match_count
  FROM hot_sheets hs
  INNER JOIN agent_settings ast ON ast.user_id = hs.user_id
  WHERE hs.is_active = true
    AND ast.agent_status = 'verified'
    -- Location match: city in criteria.cities array OR no city filter
    AND (
      hs.criteria->>'cities' IS NULL 
      OR hs.criteria->'cities' @> to_jsonb(ARRAY[p_city])
      OR jsonb_array_length(COALESCE(hs.criteria->'cities', '[]'::jsonb)) = 0
    )
    -- State match
    AND (
      hs.criteria->>'state' IS NULL 
      OR LOWER(hs.criteria->>'state') = LOWER(p_state)
    )
    -- Property type match (if specified in hot sheet)
    AND (
      hs.criteria->>'propertyTypes' IS NULL
      OR jsonb_array_length(COALESCE(hs.criteria->'propertyTypes', '[]'::jsonb)) = 0
      OR hs.criteria->'propertyTypes' @> to_jsonb(ARRAY[p_property_type])
    )
    -- Price within range
    AND (
      (hs.criteria->>'minPrice' IS NULL OR p_price >= (hs.criteria->>'minPrice')::numeric)
      AND (hs.criteria->>'maxPrice' IS NULL OR p_price <= (hs.criteria->>'maxPrice')::numeric)
    )
    -- Bedrooms minimum
    AND (
      hs.criteria->>'bedrooms' IS NULL 
      OR p_bedrooms >= (hs.criteria->>'bedrooms')::integer
    )
    -- Bathrooms minimum
    AND (
      hs.criteria->>'bathrooms' IS NULL 
      OR p_bathrooms >= (hs.criteria->>'bathrooms')::numeric
    );
  
  RETURN COALESCE(match_count, 0);
END;
$$;

-- Grant execute to anon (for pre-auth matching) and authenticated
GRANT EXECUTE ON FUNCTION public.count_matching_agents TO anon;
GRANT EXECUTE ON FUNCTION public.count_matching_agents TO authenticated;