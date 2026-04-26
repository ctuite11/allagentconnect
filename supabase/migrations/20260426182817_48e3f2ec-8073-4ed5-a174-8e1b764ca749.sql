CREATE OR REPLACE FUNCTION public.can_authenticated_buyer_view_hot_sheet_client(
  p_hot_sheet_id uuid,
  p_crm_client_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_agent_relationships car
    JOIN public.hot_sheets hs
      ON hs.id = p_hot_sheet_id
     AND hs.user_id = car.agent_id
    WHERE car.client_id = auth.uid()
      AND car.crm_client_id = p_crm_client_id
      AND car.status = 'active'
      AND car.ended_at IS NULL
  );
$$;

DROP POLICY IF EXISTS "Clients can view their hot sheet links"
  ON public.hot_sheet_clients;

CREATE POLICY "Clients can view their hot sheet links"
  ON public.hot_sheet_clients
  FOR SELECT
  TO authenticated
  USING (
    public.can_authenticated_buyer_view_hot_sheet_client(hot_sheet_id, client_id)
  );