-- Helper: archive every conversation between two users for both parties
CREATE OR REPLACE FUNCTION public.archive_conversations_between_users(
  p_user_a uuid,
  p_user_b uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_a IS NULL OR p_user_b IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.conversation_participants cp
  SET is_archived = true
  WHERE cp.user_id IN (p_user_a, p_user_b)
    AND cp.conversation_id IN (
      SELECT c.id
      FROM public.conversations c
      WHERE (c.agent_a_id = p_user_a AND c.agent_b_id = p_user_b)
         OR (c.agent_a_id = p_user_b AND c.agent_b_id = p_user_a)
    );
END;
$$;

-- Wire into agent_end_client_relationship(p_client_id uuid)
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
BEGIN
  SELECT lower(email) INTO v_client_email
  FROM public.clients
  WHERE id = p_client_id
  LIMIT 1;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_hot_sheet_ids
  FROM public.hot_sheets
  WHERE user_id = auth.uid()
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
    AND hs.user_id = auth.uid()
    AND hsc.client_id = p_client_id;

  UPDATE public.share_tokens
  SET revoked_at = now()
  WHERE agent_id = auth.uid()
    AND revoked_at IS NULL
    AND (payload->>'type') = 'client_hotsheet_invite'
    AND (
      (payload->>'client_id') = p_client_id::text
      OR (
        v_client_email IS NOT NULL
        AND lower(payload->>'client_email') = v_client_email
      )
    );

  -- Capture buyer auth user_ids before status flip so we can archive their threads
  SELECT COALESCE(array_agg(DISTINCT client_id) FILTER (WHERE client_id IS NOT NULL), ARRAY[]::uuid[])
    INTO v_buyer_user_ids
  FROM public.client_agent_relationships
  WHERE agent_id = auth.uid()
    AND ended_at IS NULL
    AND status IN ('active', 'pending')
    AND (client_id = p_client_id OR crm_client_id = p_client_id);

  UPDATE public.client_agent_relationships
  SET status = 'inactive',
      ended_at = now()
  WHERE agent_id = auth.uid()
    AND ended_at IS NULL
    AND status IN ('active', 'pending')
    AND (client_id = p_client_id OR crm_client_id = p_client_id);

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'No active or pending relationship found for agent % with identifier %.', auth.uid(), p_client_id;
  END IF;

  UPDATE public.clients
  SET client_type = NULL
  WHERE id = p_client_id
    AND agent_id = auth.uid()
    AND client_type = 'buyer';

  -- Archive any 1:1 conversations between this agent and this buyer
  IF array_length(v_buyer_user_ids, 1) IS NOT NULL THEN
    FOREACH v_buyer_uid IN ARRAY v_buyer_user_ids LOOP
      PERFORM public.archive_conversations_between_users(auth.uid(), v_buyer_uid);
    END LOOP;
  END IF;

  RETURN rows_affected;
END;
$function$;

-- Wire into agent_end_client_relationship_by_id(p_relationship_id uuid)
CREATE OR REPLACE FUNCTION public.agent_end_client_relationship_by_id(p_relationship_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent uuid := auth.uid();
  v_rel RECORD;
  v_crm_client_id uuid;
  v_client_email text;
  v_hot_sheet_ids uuid[];
  rows_affected bigint;
BEGIN
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, agent_id, client_id, crm_client_id, status, ended_at
    INTO v_rel
  FROM public.client_agent_relationships
  WHERE id = p_relationship_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Relationship not found';
  END IF;

  IF v_rel.agent_id <> v_agent THEN
    RAISE EXCEPTION 'Not authorized for this relationship';
  END IF;

  v_crm_client_id := v_rel.crm_client_id;

  IF v_crm_client_id IS NOT NULL THEN
    SELECT lower(email) INTO v_client_email
    FROM public.clients
    WHERE id = v_crm_client_id
    LIMIT 1;
  END IF;

  IF v_client_email IS NULL AND v_rel.client_id IS NOT NULL THEN
    SELECT lower(email) INTO v_client_email
    FROM public.profiles
    WHERE id = v_rel.client_id
    LIMIT 1;
  END IF;

  IF v_crm_client_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO v_hot_sheet_ids
    FROM public.hot_sheets
    WHERE user_id = v_agent
      AND client_id = v_crm_client_id;

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
      AND hsc.client_id = v_crm_client_id;
  END IF;

  UPDATE public.share_tokens
     SET revoked_at = now()
   WHERE agent_id = v_agent
     AND revoked_at IS NULL
     AND (payload->>'type') = 'client_hotsheet_invite'
     AND (
       (v_crm_client_id IS NOT NULL AND (payload->>'client_id') = v_crm_client_id::text)
       OR (v_client_email IS NOT NULL AND lower(payload->>'client_email') = v_client_email)
     );

  UPDATE public.client_agent_relationships
  SET status = 'inactive',
      ended_at = now()
  WHERE id = p_relationship_id
    AND ended_at IS NULL;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF v_crm_client_id IS NOT NULL THEN
    UPDATE public.clients
    SET client_type = NULL
    WHERE id = v_crm_client_id
      AND agent_id = v_agent
      AND client_type = 'buyer';
  END IF;

  -- Archive 1:1 conversations between this agent and this buyer
  IF v_rel.client_id IS NOT NULL THEN
    PERFORM public.archive_conversations_between_users(v_agent, v_rel.client_id);
  END IF;

  RETURN rows_affected;
END;
$function$;