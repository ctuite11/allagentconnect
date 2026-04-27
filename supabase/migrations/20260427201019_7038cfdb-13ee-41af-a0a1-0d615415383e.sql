CREATE OR REPLACE FUNCTION public.can_authenticated_user_delete_hot_sheet(p_hot_sheet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hot_sheets hs
    WHERE hs.id = p_hot_sheet_id
      AND (
        hs.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1
          FROM public.client_agent_relationships car
          WHERE car.client_id = auth.uid()
            AND car.agent_id = hs.user_id
            AND car.status = 'active'
            AND car.ended_at IS NULL
            AND (
              car.crm_client_id = hs.client_id
              OR EXISTS (
                SELECT 1
                FROM public.hot_sheet_clients hsc
                WHERE hsc.hot_sheet_id = hs.id
                  AND hsc.client_id = car.crm_client_id
              )
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.delete_hot_sheet_client_links_before_hot_sheet_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.hot_sheet_clients
  WHERE hot_sheet_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS delete_hot_sheet_client_links_before_hot_sheet_delete ON public.hot_sheets;

CREATE TRIGGER delete_hot_sheet_client_links_before_hot_sheet_delete
BEFORE DELETE ON public.hot_sheets
FOR EACH ROW
EXECUTE FUNCTION public.delete_hot_sheet_client_links_before_hot_sheet_delete();

DROP POLICY IF EXISTS "Users can delete their own hot sheets" ON public.hot_sheets;
DROP POLICY IF EXISTS "Admins can delete hot sheets" ON public.hot_sheets;

CREATE POLICY "Authorized users can delete hot sheets"
ON public.hot_sheets
FOR DELETE
TO authenticated
USING (public.can_authenticated_user_delete_hot_sheet(id));

DROP POLICY IF EXISTS "Users can remove clients from their hot sheets" ON public.hot_sheet_clients;

CREATE POLICY "Authorized users can delete hot sheet client links"
ON public.hot_sheet_clients
FOR DELETE
TO authenticated
USING (public.can_authenticated_user_delete_hot_sheet(hot_sheet_id));