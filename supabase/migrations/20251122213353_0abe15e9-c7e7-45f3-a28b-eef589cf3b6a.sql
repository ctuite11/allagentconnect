-- Create share_tokens table
CREATE TABLE public.share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_share_tokens_agent_id ON public.share_tokens(agent_id);
CREATE INDEX idx_share_tokens_expires_at ON public.share_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Agents can create their own tokens
CREATE POLICY "Agents can create their own tokens"
  ON public.share_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = agent_id);

-- Policy: Agents can view their own tokens
CREATE POLICY "Agents can view their own tokens"
  ON public.share_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_id);

-- Policy: Anyone can validate tokens (for public share links)
CREATE POLICY "Anyone can validate tokens"
  ON public.share_tokens
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Agents can delete their own tokens
CREATE POLICY "Agents can delete their own tokens"
  ON public.share_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = agent_id);

-- Policy: Agents can update their own tokens
CREATE POLICY "Agents can update their own tokens"
  ON public.share_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = agent_id);

-- Optional cleanup function for expired tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_share_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.share_tokens
  WHERE expires_at IS NOT NULL 
    AND expires_at < now();
END;
$$;