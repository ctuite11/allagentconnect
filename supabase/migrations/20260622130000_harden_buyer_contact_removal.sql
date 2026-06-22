-- Hardening: read-only buyer/contact verification, orphan-safe removal, audit trail.

-- A) Read-only verification for a CRM contact row (agent-scoped).
CREATE OR REPLACE FUNCTION public.verify_buyer_contact_row(p_crm_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent uuid := auth.uid();
  v_client RECORD;
BEGIN
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, agent_id, first_name, last_name, lower(email) AS email, phone, client_type, created_at
    INTO v_client
  FROM public.clients
  WHERE id = p_crm_client_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found', false,
      'crm_client_id', p_crm_client_id,
      'agent_id', v_agent
    );
  END IF;

  IF v_client.agent_id <> v_agent THEN
    RAISE EXCEPTION 'Not authorized for this contact';
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'crm_client_id', p_crm_client_id,
    'agent_id', v_agent,
    'client', jsonb_build_object(
      'id', v_client.id,
      'first_name', v_client.first_name,
      'last_name', v_client.last_name,
      'email', v_client.email,
      'phone', v_client.phone,
      'client_type', v_client.client_type,
      'created_at', v_client.created_at
    ),
    'relationships', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'status', r.status,
          'client_id', r.client_id,
          'crm_client_id', r.crm_client_id,
          'ended_at', r.ended_at,
          'created_at', r.created_at
        )
        ORDER BY r.created_at DESC
      )
      FROM public.client_agent_relationships r
      WHERE r.agent_id = v_agent
        AND (r.crm_client_id = p_crm_client_id OR r.client_id = p_crm_client_id)
    ), '[]'::jsonb),
    'active_relationship_count', (
      SELECT count(*)::integer
      FROM public.client_agent_relationships r
      WHERE r.agent_id = v_agent
        AND r.ended_at IS NULL
        AND r.status IN ('active', 'pending')
        AND (r.crm_client_id = p_crm_client_id OR r.client_id = p_crm_client_id)
    ),
    'hot_sheet_memberships', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'hot_sheet_id', hsc.hot_sheet_id,
          'hot_sheet_title', hs.title
        )
      )
      FROM public.hot_sheet_clients hsc
      JOIN public.hot_sheets hs ON hs.id = hsc.hot_sheet_id
      WHERE hsc.client_id = p_crm_client_id
        AND hs.user_id = v_agent
    ), '[]'::jsonb),
    'owned_hot_sheets', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', hs.id,
          'title', hs.title,
          'created_at', hs.created_at
        )
        ORDER BY hs.created_at DESC
      )
      FROM public.hot_sheets hs
      WHERE hs.user_id = v_agent
        AND hs.client_id = p_crm_client_id
    ), '[]'::jsonb),
    'share_tokens', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', st.id,
          'accepted_at', st.accepted_at,
          'revoked_at', st.revoked_at,
          'created_at', st.created_at
        )
        ORDER BY st.created_at DESC
      )
      FROM public.share_tokens st
      WHERE st.agent_id = v_agent
        AND (st.payload->>'type') = 'client_hotsheet_invite'
        AND (
          (st.payload->>'client_id') = p_crm_client_id::text
          OR (
            v_client.email IS NOT NULL
            AND lower(st.payload->>'client_email') = v_client.email
          )
        )
    ), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.verify_buyer_contact_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_buyer_contact_row(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_buyer_contact_row(uuid) TO service_role;

COMMENT ON FUNCTION public.verify_buyer_contact_row(uuid) IS
  'Read-only agent-scoped snapshot of a CRM contact, relationships, hot sheets, and invite tokens.';

-- C + D) Orphan-safe buyer removal + durable audit log.
CREATE OR REPLACE FUNCTION public.agent_end_client_relationship(p_client_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rows_affected bigint;
  v_hot_sheet_ids uuid[];
  v_client_email text;
  v_buyer_user_ids uuid[];
  v_buyer_uid uuid;
  v_agent uuid := auth.uid();
  v_owned_contact boolean := false;
  v_audit_action text;
BEGIN
  SELECT lower(email) INTO v_client_email
  FROM public.clients
  WHERE id = p_client_id
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = p_client_id
      AND c.agent_id = v_agent
  ) INTO v_owned_contact;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_hot_sheet_ids
  FROM public.hot_sheets
  WHERE user_id = v_agent
    AND client_id = p_client_id;

  IF array_length(v_hot_sheet_ids, 1) IS NOT NULL THEN
    DELETE FROM public.hot_sheet_sent_listings  WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_comments       WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_listing_status WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_notifications  WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_favorites      WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_clients        WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheets               WHERE id            = ANY(v_hot_sheet_ids);
  END IF;

  DELETE FROM public.hot_sheet_clients hsc
  USING public.hot_sheets hs
  WHERE hsc.hot_sheet_id = hs.id
    AND hs.user_id = v_agent
    AND hsc.client_id = p_client_id;

  UPDATE public.share_tokens
  SET revoked_at = now()
  WHERE agent_id = v_agent
    AND revoked_at IS NULL
    AND (payload->>'type') = 'client_hotsheet_invite'
    AND (
      (payload->>'client_id') = p_client_id::text
      OR (
        v_client_email IS NOT NULL
        AND lower(payload->>'client_email') = v_client_email
      )
    );

  SELECT COALESCE(array_agg(DISTINCT client_id) FILTER (WHERE client_id IS NOT NULL), ARRAY[]::uuid[])
    INTO v_buyer_user_ids
  FROM public.client_agent_relationships
  WHERE agent_id = v_agent
    AND ended_at IS NULL
    AND status IN ('active', 'pending')
    AND (client_id = p_client_id OR crm_client_id = p_client_id);

  UPDATE public.client_agent_relationships
  SET status = 'inactive',
      ended_at = now()
  WHERE agent_id = v_agent
    AND ended_at IS NULL
    AND status IN ('active', 'pending')
    AND (client_id = p_client_id OR crm_client_id = p_client_id);

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    IF NOT v_owned_contact THEN
      RAISE EXCEPTION 'No active or pending relationship found for agent % with identifier %.', v_agent, p_client_id;
    END IF;
    v_audit_action := 'END_BUYER_ORPHAN_CONTACT';
  ELSE
    v_audit_action := 'END_BUYER_RELATIONSHIP';
  END IF;

  UPDATE public.clients
  SET client_type = NULL
  WHERE id = p_client_id
    AND agent_id = v_agent
    AND client_type = 'buyer';

  IF array_length(v_buyer_user_ids, 1) IS NOT NULL THEN
    FOREACH v_buyer_uid IN ARRAY v_buyer_user_ids LOOP
      PERFORM public.archive_conversations_between_users(v_agent, v_buyer_uid);
    END LOOP;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
  VALUES (v_agent, v_audit_action, 'clients', p_client_id);

  RETURN rows_affected;
END;
$function$;
