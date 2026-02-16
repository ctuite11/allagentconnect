DROP POLICY IF EXISTS "Agents can update their own tokens"
  ON public.share_tokens;

CREATE POLICY "Agents can update their own tokens"
  ON public.share_tokens
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = agent_id
    AND accepted_by_user_id IS NULL
    AND accepted_at IS NULL
  );