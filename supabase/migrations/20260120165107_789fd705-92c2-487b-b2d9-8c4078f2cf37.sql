-- Create agent_invites table for tracking referrals
CREATE TABLE IF NOT EXISTS public.agent_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID REFERENCES auth.users(id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_agent_invites_inviter ON public.agent_invites(inviter_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_invites_invitee_email ON public.agent_invites(lower(invitee_email));

-- Enable RLS
ALTER TABLE public.agent_invites ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own invites
CREATE POLICY "inviter can insert" ON public.agent_invites
FOR INSERT TO authenticated
WITH CHECK (inviter_user_id = auth.uid());

-- Users can read their own invites
CREATE POLICY "inviter can read own invites" ON public.agent_invites
FOR SELECT TO authenticated
USING (inviter_user_id = auth.uid());