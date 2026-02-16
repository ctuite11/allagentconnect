-- Drop the current loose client UPDATE policy
DROP POLICY IF EXISTS "Clients can accept tokens via email"
  ON public.share_tokens;

-- Recreate with tighter conditions: only unaccepted, only client_hotsheet_invite type
CREATE POLICY "Clients can accept tokens via email"
  ON public.share_tokens
  FOR UPDATE
  TO authenticated
  USING (
    accepted_by_user_id IS NULL
    AND payload->>'type' = 'client_hotsheet_invite'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND lower(p.email) = lower(share_tokens.payload->>'client_email')
    )
  )
  WITH CHECK (accepted_by_user_id = auth.uid());