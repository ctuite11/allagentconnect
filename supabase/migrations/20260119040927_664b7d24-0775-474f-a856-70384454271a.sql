-- =====================================================
-- Seller Matches MVP - Baby Step 1
-- =====================================================

-- 1. Add columns to agent_match_submissions
ALTER TABLE public.agent_match_submissions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT NOT NULL DEFAULT 'email';

-- Add check constraint for preferred_contact_method
ALTER TABLE public.agent_match_submissions
ADD CONSTRAINT check_preferred_contact_method 
CHECK (preferred_contact_method IN ('email', 'text', 'phone'));

-- 2. Add notified_agent_at column to agent_match_deliveries
ALTER TABLE public.agent_match_deliveries
ADD COLUMN IF NOT EXISTS notified_agent_at TIMESTAMPTZ;

-- 3. Ensure unique constraint exists for dedupe (already exists as unique(submission_id, agent_id))
-- Adding hot_sheet_id to the unique constraint for proper tracking
-- First drop existing constraint if it exists, then recreate with hot_sheet_id
ALTER TABLE public.agent_match_deliveries
DROP CONSTRAINT IF EXISTS agent_match_deliveries_submission_id_agent_id_key;

ALTER TABLE public.agent_match_deliveries
ADD CONSTRAINT agent_match_deliveries_unique_match 
UNIQUE (submission_id, agent_id, hot_sheet_id);

-- 4. Create index for expires_at queries (for future cleanup/expiration)
CREATE INDEX IF NOT EXISTS idx_agent_match_submissions_expires_at 
ON public.agent_match_submissions(expires_at)
WHERE status = 'paid';

-- 5. Create storage bucket for agent-match-photos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-match-photos', 'agent-match-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage policies for agent-match-photos bucket
CREATE POLICY "Public can view agent match photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-match-photos');

CREATE POLICY "Authenticated users can upload agent match photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'agent-match-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own agent match photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'agent-match-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own agent match photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'agent-match-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 7. RLS policy for verified agents to view submissions they've been matched with
CREATE POLICY "Verified agents can view matched submissions"
ON public.agent_match_submissions FOR SELECT
USING (
  -- Owner can always see their own
  auth.uid() = user_id
  OR
  -- Verified agents can see submissions they've been matched to
  EXISTS (
    SELECT 1 FROM public.agent_match_deliveries d
    WHERE d.submission_id = agent_match_submissions.id
    AND d.agent_id = auth.uid()
  )
);