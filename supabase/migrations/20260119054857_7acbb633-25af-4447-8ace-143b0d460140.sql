-- Admin Outcome Tracker — Finish Line Migration
-- Adds missing columns, enhances trigger, backfills data, adds indexes

-- 1) Add missing columns (safe / idempotent)
ALTER TABLE public.seller_matches
  ADD COLUMN IF NOT EXISTS latest_outcome_id uuid NULL,
  ADD COLUMN IF NOT EXISTS latest_outcome_notes text NULL;

ALTER TABLE public.seller_match_outcomes
  ADD COLUMN IF NOT EXISTS outcome_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz NULL;

-- 2) Enhance trigger function to denormalize latest outcome fields
-- NOTE: keep enum strategy: seller_matches.latest_outcome remains seller_match_outcome
CREATE OR REPLACE FUNCTION public.update_seller_match_latest_outcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.seller_matches sm
  SET
    latest_outcome       = NEW.outcome,          -- enum
    latest_outcome_at    = NEW.created_at,
    latest_outcome_id    = NEW.id,
    latest_outcome_notes = NEW.notes,
    next_followup_at     = COALESCE(NEW.next_followup_at, sm.next_followup_at),
    updated_at           = now()
  WHERE sm.id = NEW.match_id;

  RETURN NEW;
END $$;

-- Make sure the trigger uses the enhanced function
DROP TRIGGER IF EXISTS trg_seller_match_outcomes_latest ON public.seller_match_outcomes;
CREATE TRIGGER trg_seller_match_outcomes_latest
AFTER INSERT ON public.seller_match_outcomes
FOR EACH ROW
EXECUTE FUNCTION public.update_seller_match_latest_outcome();

-- 3) Backfill seller_matches from existing deliveries
INSERT INTO public.seller_matches (submission_id, delivery_id, agent_id, hot_sheet_id, created_at)
SELECT
  d.submission_id,
  d.id AS delivery_id,
  d.agent_id,
  d.hot_sheet_id,
  d.created_at
FROM public.agent_match_deliveries d
ON CONFLICT (submission_id, agent_id) DO UPDATE
SET
  created_at  = LEAST(public.seller_matches.created_at, EXCLUDED.created_at),
  delivery_id = COALESCE(public.seller_matches.delivery_id, EXCLUDED.delivery_id),
  hot_sheet_id = COALESCE(public.seller_matches.hot_sheet_id, EXCLUDED.hot_sheet_id),
  updated_at  = now();

-- 4) Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_seller_matches_created_at
  ON public.seller_matches (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_matches_latest_outcome
  ON public.seller_matches (latest_outcome);

CREATE INDEX IF NOT EXISTS idx_seller_matches_next_followup
  ON public.seller_matches (next_followup_at);

CREATE INDEX IF NOT EXISTS idx_seller_matches_archived_at
  ON public.seller_matches (archived_at);

CREATE INDEX IF NOT EXISTS idx_seller_matches_submission_id
  ON public.seller_matches (submission_id);

CREATE INDEX IF NOT EXISTS idx_seller_matches_agent_id
  ON public.seller_matches (agent_id);

CREATE INDEX IF NOT EXISTS idx_seller_matches_delivery_id
  ON public.seller_matches (delivery_id);

CREATE INDEX IF NOT EXISTS idx_seller_match_outcomes_match_created
  ON public.seller_match_outcomes (match_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_match_outcomes_outcome
  ON public.seller_match_outcomes (outcome);

CREATE INDEX IF NOT EXISTS idx_seller_match_outcomes_next_followup
  ON public.seller_match_outcomes (next_followup_at);