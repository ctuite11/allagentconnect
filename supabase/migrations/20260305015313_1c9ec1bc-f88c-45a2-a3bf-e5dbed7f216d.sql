
-- 1) Create dedicated buyer_workspace_invites table
CREATE TABLE public.buyer_workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  workspace_id uuid NOT NULL REFERENCES public.buyer_workspaces(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agent_profiles(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL,
  buyer_email text NOT NULL,
  buyer_first_name text,
  buyer_last_name text,
  buyer_user_id uuid,
  accepted_at timestamptz,
  accepted_by_user_id uuid,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Enable RLS
ALTER TABLE public.buyer_workspace_invites ENABLE ROW LEVEL SECURITY;

-- 3) Agent-only RLS policies (no client policies; acceptance via Edge Function service role)

-- Agents: create
CREATE POLICY "Agents can create buyer workspace invites"
ON public.buyer_workspace_invites
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = agent_id);

-- Agents: view own
CREATE POLICY "Agents can view own buyer workspace invites"
ON public.buyer_workspace_invites
FOR SELECT
TO authenticated
USING (auth.uid() = agent_id);

-- Agents: update own (ONLY before acceptance)
CREATE POLICY "Agents can update own buyer workspace invites"
ON public.buyer_workspace_invites
FOR UPDATE
TO authenticated
USING (
  auth.uid() = agent_id
  AND accepted_at IS NULL
  AND accepted_by_user_id IS NULL
)
WITH CHECK (
  auth.uid() = agent_id
  AND accepted_at IS NULL
  AND accepted_by_user_id IS NULL
);

-- Agents: delete own
CREATE POLICY "Agents can delete own buyer workspace invites"
ON public.buyer_workspace_invites
FOR DELETE
TO authenticated
USING (auth.uid() = agent_id);

-- 4) Immutability trigger: freeze acceptance fields once set
CREATE OR REPLACE FUNCTION public.prevent_bwi_acceptance_overwrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF old.accepted_by_user_id IS NOT NULL THEN
    IF new.accepted_by_user_id IS DISTINCT FROM old.accepted_by_user_id
       OR new.accepted_at IS DISTINCT FROM old.accepted_at THEN
      RAISE EXCEPTION 'buyer_workspace_invites acceptance is immutable once accepted';
    END IF;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_bwi_acceptance_overwrite ON public.buyer_workspace_invites;
CREATE TRIGGER trg_prevent_bwi_acceptance_overwrite
BEFORE UPDATE ON public.buyer_workspace_invites
FOR EACH ROW
EXECUTE FUNCTION public.prevent_bwi_acceptance_overwrite();

-- 5) Indexes for common lookups
CREATE INDEX idx_bwi_token ON public.buyer_workspace_invites (token);
CREATE INDEX idx_bwi_workspace ON public.buyer_workspace_invites (workspace_id);
CREATE INDEX idx_bwi_agent ON public.buyer_workspace_invites (agent_id);
