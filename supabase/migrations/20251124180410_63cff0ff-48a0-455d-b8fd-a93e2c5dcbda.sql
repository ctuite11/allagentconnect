-- Add invitation acceptance tracking to share_tokens
ALTER TABLE public.share_tokens
ADD COLUMN accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN accepted_by_user_id UUID REFERENCES auth.users(id);

-- Create client-agent relationships table
CREATE TABLE public.client_agent_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  invitation_token TEXT REFERENCES public.share_tokens(token),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, agent_id)
);

-- Enable RLS on client_agent_relationships
ALTER TABLE public.client_agent_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_agent_relationships
-- Clients can view their own relationships
CREATE POLICY "Clients can view their own relationships"
ON public.client_agent_relationships
FOR SELECT
TO authenticated
USING (auth.uid() = client_id);

-- Agents can view relationships where they're the agent
CREATE POLICY "Agents can view their agent relationships"
ON public.client_agent_relationships
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE agent_profiles.id = client_agent_relationships.agent_id
    AND agent_profiles.id = auth.uid()
  )
);

-- Both can insert (for onboarding)
CREATE POLICY "Users can create relationships"
ON public.client_agent_relationships
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = client_id);

-- Create index for faster lookups
CREATE INDEX idx_client_agent_relationships_client_id ON public.client_agent_relationships(client_id);
CREATE INDEX idx_client_agent_relationships_agent_id ON public.client_agent_relationships(agent_id);