
-- Allow clients to see their own hot_sheet_clients rows
CREATE POLICY "Clients can view their hot sheet links"
ON public.hot_sheet_clients
FOR SELECT
TO authenticated
USING (client_id = auth.uid());
