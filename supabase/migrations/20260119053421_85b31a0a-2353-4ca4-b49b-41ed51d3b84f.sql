-- ============================================
-- Admin Outcome Tracker: seller_matches + seller_match_outcomes
-- ============================================

-- 1. Create outcome enum type for type safety
CREATE TYPE public.seller_match_outcome AS ENUM (
  'pending',
  'no_response',
  'not_a_fit',
  'connected',
  'showing_scheduled',
  'offer_submitted',
  'offer_accepted',
  'closed_won',
  'closed_lost',
  'duplicate',
  'invalid'
);

-- 2. Create seller_matches table (one row per unique submission+agent pair)
CREATE TABLE public.seller_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.agent_match_submissions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hot_sheet_id UUID REFERENCES public.hot_sheets(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES public.agent_match_deliveries(id) ON DELETE SET NULL,
  
  -- Contact tracking
  contact_attempts INTEGER NOT NULL DEFAULT 0,
  first_contacted_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  last_contact_note TEXT,
  
  -- Follow-up scheduling (TIMESTAMPTZ for time-of-day precision)
  next_followup_at TIMESTAMPTZ,
  followup_reason TEXT,
  
  -- Latest outcome (denormalized from seller_match_outcomes for query efficiency)
  -- ONLY updated via trigger on seller_match_outcomes insert
  latest_outcome public.seller_match_outcome NOT NULL DEFAULT 'pending',
  latest_outcome_at TIMESTAMPTZ,
  
  -- Archival
  archived_at TIMESTAMPTZ,
  archived_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one match row per submission+agent pair
  UNIQUE(submission_id, agent_id)
);

-- 3. Create seller_match_outcomes table (append-only audit log)
CREATE TABLE public.seller_match_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.seller_matches(id) ON DELETE CASCADE,
  outcome public.seller_match_outcome NOT NULL,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes for common queries
CREATE INDEX idx_seller_matches_submission ON public.seller_matches(submission_id);
CREATE INDEX idx_seller_matches_agent ON public.seller_matches(agent_id);
CREATE INDEX idx_seller_matches_outcome ON public.seller_matches(latest_outcome);
CREATE INDEX idx_seller_matches_followup ON public.seller_matches(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX idx_seller_matches_archived ON public.seller_matches(archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_seller_match_outcomes_match ON public.seller_match_outcomes(match_id);

-- 5. Trigger: auto-update updated_at on seller_matches
CREATE TRIGGER set_seller_matches_updated_at
  BEFORE UPDATE ON public.seller_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 6. Trigger: auto-update latest_outcome on seller_matches when outcome is inserted
CREATE OR REPLACE FUNCTION public.update_seller_match_latest_outcome()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.seller_matches
  SET 
    latest_outcome = NEW.outcome,
    latest_outcome_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.match_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER set_seller_match_latest_outcome
  AFTER INSERT ON public.seller_match_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_seller_match_latest_outcome();

-- 7. Trigger: auto-create seller_matches row when agent_match_deliveries row is inserted
CREATE OR REPLACE FUNCTION public.create_seller_match_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.seller_matches (submission_id, agent_id, hot_sheet_id, delivery_id)
  VALUES (NEW.submission_id, NEW.agent_id, NEW.hot_sheet_id, NEW.id)
  ON CONFLICT (submission_id, agent_id) DO UPDATE SET
    delivery_id = COALESCE(public.seller_matches.delivery_id, EXCLUDED.delivery_id),
    hot_sheet_id = COALESCE(public.seller_matches.hot_sheet_id, EXCLUDED.hot_sheet_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER create_seller_match_on_delivery_insert
  AFTER INSERT ON public.agent_match_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.create_seller_match_on_delivery();

-- 8. Backfill: create seller_matches from existing agent_match_deliveries
INSERT INTO public.seller_matches (submission_id, agent_id, hot_sheet_id, delivery_id, created_at)
SELECT 
  d.submission_id,
  d.agent_id,
  d.hot_sheet_id,
  d.id,
  d.created_at
FROM public.agent_match_deliveries d
ON CONFLICT (submission_id, agent_id) DO NOTHING;

-- 9. RLS: Enable and lock to admin only
ALTER TABLE public.seller_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_match_outcomes ENABLE ROW LEVEL SECURITY;

-- seller_matches policies (admin only)
CREATE POLICY "Admin can view all seller matches"
  ON public.seller_matches FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert seller matches"
  ON public.seller_matches FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update seller matches"
  ON public.seller_matches FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete seller matches"
  ON public.seller_matches FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- seller_match_outcomes policies (admin only)
CREATE POLICY "Admin can view all seller match outcomes"
  ON public.seller_match_outcomes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert seller match outcomes"
  ON public.seller_match_outcomes FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- No update/delete on outcomes (append-only audit log)