
-- A) Allow clients to mark tokens as accepted
CREATE POLICY "Clients can accept tokens via email"
  ON public.share_tokens
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND lower(p.email) = lower(share_tokens.payload->>'client_email')
    )
  )
  WITH CHECK (accepted_by_user_id = auth.uid());

-- B) Fix hot_sheet_clients SELECT policy (CRM ID vs auth ID mismatch)
DROP POLICY IF EXISTS "Clients can view their hot sheet links"
  ON public.hot_sheet_clients;

CREATE POLICY "Clients can view their hot sheet links"
  ON public.hot_sheet_clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN profiles p ON lower(c.email) = lower(p.email)
      WHERE c.id = hot_sheet_clients.client_id
        AND p.id = auth.uid()
    )
  );

-- C) Backfill older tokens missing client_email in payload
UPDATE share_tokens
SET payload = payload || jsonb_build_object('client_email', c.email)
FROM clients c
WHERE share_tokens.payload->>'client_id' = c.id::text
  AND share_tokens.payload->>'client_email' IS NULL
  AND share_tokens.payload->>'type' = 'client_hotsheet_invite';
