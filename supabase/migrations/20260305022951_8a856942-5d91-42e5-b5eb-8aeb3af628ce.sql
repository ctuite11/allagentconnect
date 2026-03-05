
-- 1) Drop redundant token index (unique constraint already provides an index)
DROP INDEX IF EXISTS public.idx_bwi_token;

-- 2) Fast lookup for pending invites list
CREATE INDEX IF NOT EXISTS idx_bwi_workspace_pending_created_at
ON public.buyer_workspace_invites (workspace_id, created_at DESC)
WHERE accepted_at IS NULL;

-- 3) Fast lookup for email-based duplicate check
CREATE INDEX IF NOT EXISTS idx_bwi_workspace_email_pending
ON public.buyer_workspace_invites (workspace_id, buyer_email)
WHERE accepted_at IS NULL;

-- 4) Prevent duplicate pending invites per workspace+email
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bwi_pending_invite_per_email
ON public.buyer_workspace_invites (workspace_id, lower(buyer_email))
WHERE accepted_at IS NULL;

-- 5) Creator lookup index
CREATE INDEX IF NOT EXISTS idx_bwi_created_by_pending
ON public.buyer_workspace_invites (created_by_user_id, created_at DESC)
WHERE accepted_at IS NULL;
