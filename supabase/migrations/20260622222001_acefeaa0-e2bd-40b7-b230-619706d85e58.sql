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

  -- If the contact is CRM-only, deleting the CRM row would otherwise cause the
  -- foreign key to clear crm_client_id on these rows while client_id is already
  -- null, violating client_agent_relationships_identity_present.
  DELETE FROM public.client_agent_relationships
  WHERE agent_id = v_agent
    AND crm_client_id = p_client_id
    AND client_id IS NULL;

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