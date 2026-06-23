-- Allow buyers to view hot_sheet_clients rows when their profile email matches the
-- linked client email, even when no client_agent_relationships row carries a matching
-- crm_client_id yet. Fixes empty Hot Sheets tab after invite acceptance when the
-- accept flow couldn't resolve a crm_client_id from the token payload.

CREATE OR REPLACE FUNCTION public.can_authenticated_buyer_view_hot_sheet_client(
  p_hot_sheet_id uuid,
  p_crm_client_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  -- Primary path: active CRM relationship link (unchanged).
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
  )
  -- Fallback: buyer's profile email matches the CRM client's email AND the hot sheet
  -- belongs to an agent the buyer has any (active or historical) relationship with.
  OR EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.profiles p ON lower(btrim(p.email)) = lower(btrim(c.email))
    JOIN public.hot_sheets hs
      ON hs.id = p_hot_sheet_id
     AND hs.user_id = c.agent_id
    JOIN public.client_agent_relationships car
      ON car.client_id = p.id
     AND car.agent_id = c.agent_id
    WHERE c.id = p_crm_client_id
      AND p.id = auth.uid()
      AND nullif(btrim(c.email), '') IS NOT NULL
  )
  -- Token-based fallback: an accepted client_hotsheet_invite share token exists
  -- naming this hot sheet for this CRM client (or the buyer's email).
  OR EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.profiles p ON p.id = auth.uid()
    JOIN public.share_tokens st
      ON st.accepted_at IS NOT NULL
     AND (st.payload->>'type') = 'client_hotsheet_invite'
     AND (st.payload->>'hot_sheet_id') = p_hot_sheet_id::text
     AND (
       (st.payload->>'client_id') = p_crm_client_id::text
       OR (
         nullif(btrim(lower(c.email::text)), '') IS NOT NULL
         AND nullif(btrim(lower(st.payload->>'client_email')), '')
           = nullif(btrim(lower(c.email::text)), '')
         AND lower(btrim(p.email)) = lower(btrim(c.email))
       )
     )
    WHERE c.id = p_crm_client_id
  );
$function$;