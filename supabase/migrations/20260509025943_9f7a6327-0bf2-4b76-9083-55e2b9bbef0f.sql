CREATE OR REPLACE FUNCTION public.delete_pending_buyer_hot_sheet(
  p_hot_sheet_id uuid,
  p_crm_client_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hs_agent uuid;
  v_client_email text;
  v_other_clients integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT hs.user_id
  INTO v_hs_agent
  FROM public.hot_sheets hs
  WHERE hs.id = p_hot_sheet_id;

  IF v_hs_agent IS NULL THEN
    RAISE EXCEPTION 'Hot sheet not found';
  END IF;

  IF v_hs_agent <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.hot_sheet_clients hsc
    WHERE hsc.hot_sheet_id = p_hot_sheet_id
      AND hsc.client_id = p_crm_client_id
  ) THEN
    RAISE EXCEPTION 'Hot sheet is not linked to this buyer';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_agent_relationships car
    WHERE car.agent_id = v_hs_agent
      AND car.crm_client_id = p_crm_client_id
      AND car.status = 'active'
      AND car.client_id IS NOT NULL
      AND car.ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Buyer has joined the shared workspace; this hot sheet cannot be deleted';
  END IF;

  SELECT NULLIF(trim(lower(c.email::text)), '')
  INTO v_client_email
  FROM public.clients c
  WHERE c.id = p_crm_client_id;

  IF EXISTS (
    SELECT 1
    FROM public.share_tokens st
    WHERE st.agent_id = v_hs_agent
      AND st.accepted_at IS NOT NULL
      AND (st.payload->>'type') = 'client_hotsheet_invite'
      AND (st.payload->>'hot_sheet_id') = p_hot_sheet_id::text
      AND (
        (st.payload->>'client_id') = p_crm_client_id::text
        OR (
          v_client_email IS NOT NULL
          AND NULLIF(trim(lower(st.payload->>'client_email')), '') = v_client_email
        )
      )
  ) THEN
    RAISE EXCEPTION 'This hot sheet invite was already accepted';
  END IF;

  DELETE FROM public.share_tokens st
  WHERE st.agent_id = v_hs_agent
    AND (st.payload->>'type') = 'client_hotsheet_invite'
    AND (st.payload->>'hot_sheet_id') = p_hot_sheet_id::text
    AND (
      (st.payload->>'client_id') = p_crm_client_id::text
      OR (
        v_client_email IS NOT NULL
        AND NULLIF(trim(lower(st.payload->>'client_email')), '') = v_client_email
      )
    );

  SELECT count(*)::integer
  INTO v_other_clients
  FROM public.hot_sheet_clients hsc
  WHERE hsc.hot_sheet_id = p_hot_sheet_id
    AND hsc.client_id <> p_crm_client_id;

  IF v_other_clients = 0 THEN
    DELETE FROM public.hot_sheets WHERE id = p_hot_sheet_id;
    RETURN jsonb_build_object(
      'action', 'deleted_hot_sheet',
      'hot_sheet_id', p_hot_sheet_id
    );
  END IF;

  DELETE FROM public.hot_sheet_clients
  WHERE hot_sheet_id = p_hot_sheet_id
    AND client_id = p_crm_client_id;

  RETURN jsonb_build_object(
    'action', 'unlinked_client',
    'hot_sheet_id', p_hot_sheet_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_pending_buyer_hot_sheet(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_pending_buyer_hot_sheet(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_pending_buyer_hot_sheet(uuid, uuid) IS
  'Agent removes a pending (unaccepted) hot sheet for a CRM client, or unlinks that client if other clients remain.';