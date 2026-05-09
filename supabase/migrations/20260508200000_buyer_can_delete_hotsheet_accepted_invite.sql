-- Allow authenticated buyers to delete hot sheets they can access via accepted
-- client_hotsheet_invite tokens (accepted_by_user_id), even when the CAR / hsc
-- path alone would not grant delete.

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
        OR EXISTS (
          SELECT 1
          FROM public.share_tokens st
          WHERE st.agent_id = hs.user_id
            AND st.accepted_at IS NOT NULL
            AND st.accepted_by_user_id = auth.uid()
            AND coalesce(st.payload->>'type', '') = 'client_hotsheet_invite'
            AND coalesce(st.payload->>'hot_sheet_id', '') = hs.id::text
        )
      )
  );
$$;

COMMENT ON FUNCTION public.can_authenticated_user_delete_hot_sheet(uuid) IS
  'True if the current user may delete this hot sheet (owner, admin, linked buyer, or accepted invite recipient).';
