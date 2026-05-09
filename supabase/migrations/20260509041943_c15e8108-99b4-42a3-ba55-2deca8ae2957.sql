-- Migration 20260508200000: buyer can delete hot sheet via accepted invite
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

-- Migration 20260508203000: agent cannot delete shared hot sheets
CREATE OR REPLACE FUNCTION public.hot_sheet_has_shared_workspace_recipients(p_hot_sheet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hot_sheet_clients hsc
    INNER JOIN public.hot_sheets hs ON hs.id = hsc.hot_sheet_id
    INNER JOIN public.client_agent_relationships car
      ON car.crm_client_id = hsc.client_id
     AND car.agent_id = hs.user_id
     AND car.status = 'active'
     AND car.ended_at IS NULL
     AND car.client_id IS NOT NULL
    WHERE hsc.hot_sheet_id = p_hot_sheet_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.hot_sheet_clients hsc
    INNER JOIN public.hot_sheets hs ON hs.id = hsc.hot_sheet_id
    INNER JOIN public.clients c ON c.id = hsc.client_id
    INNER JOIN public.share_tokens st
      ON st.agent_id = hs.user_id
     AND st.accepted_at IS NOT NULL
     AND (st.payload->>'type') = 'client_hotsheet_invite'
     AND (st.payload->>'hot_sheet_id') = p_hot_sheet_id::text
     AND (
       (st.payload->>'client_id') = hsc.client_id::text
       OR (
         NULLIF(trim(lower(c.email::text)), '') IS NOT NULL
         AND NULLIF(trim(lower(st.payload->>'client_email')), '')
           = NULLIF(trim(lower(c.email::text)), '')
       )
     )
    WHERE hsc.hot_sheet_id = p_hot_sheet_id
  );
$$;

COMMENT ON FUNCTION public.hot_sheet_has_shared_workspace_recipients(uuid) IS
  'True if this hot sheet is part of an accepted/shared group (AAC-linked buyer or accepted hot sheet invite for a linked client).';

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
        public.has_role(auth.uid(), 'admin')
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
        OR (
          hs.user_id = auth.uid()
          AND NOT public.hot_sheet_has_shared_workspace_recipients(hs.id)
        )
      )
  );
$$;

COMMENT ON FUNCTION public.can_authenticated_user_delete_hot_sheet(uuid) IS
  'Delete allowed for admin; buyers with access; sheet-owning agents only when the sheet has no shared/accepted recipients.';

COMMENT ON FUNCTION public.delete_pending_buyer_hot_sheet(uuid, uuid) IS
  'Agent-only: remove one CRM buyer''s pending (unaccepted) hot sheet invite/link. Does not remove accepted/shared group sheets.';