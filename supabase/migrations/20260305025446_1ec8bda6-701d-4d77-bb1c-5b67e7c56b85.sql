ALTER TABLE public.buyer_workspace_invites
ADD COLUMN IF NOT EXISTS last_resent_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_bwi_last_resent_at
ON public.buyer_workspace_invites (last_resent_at);