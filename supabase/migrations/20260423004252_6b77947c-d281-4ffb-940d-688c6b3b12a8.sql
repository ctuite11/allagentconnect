
-- ============================================================
-- Buyer reactivation + remove-flow unification
-- ============================================================

-- 1) Reactivation RPC: re-add an existing CRM contact as a buyer
--    instead of trying to insert a duplicate `clients` row.
CREATE OR REPLACE FUNCTION public.agent_reactivate_buyer(p_crm_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent uuid := auth.uid();
  v_client RECORD;
  v_rel RECORD;
  v_new_status text;
  v_new_id uuid;
BEGIN
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify ownership
  SELECT id, agent_id, email, client_type
    INTO v_client
  FROM public.clients
  WHERE id = p_crm_client_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  IF v_client.agent_id <> v_agent THEN
    RAISE EXCEPTION 'Not authorized for this contact';
  END IF;

  -- Normalize to buyer
  IF v_client.client_type IS DISTINCT FROM 'buyer' THEN
    UPDATE public.clients
       SET client_type = 'buyer'
     WHERE id = p_crm_client_id;
  END IF;

  -- Latest relationship row for this agent + crm contact
  SELECT id, client_id, crm_client_id, status, ended_at
    INTO v_rel
  FROM public.client_agent_relationships
  WHERE agent_id = v_agent
    AND (crm_client_id = p_crm_client_id)
  ORDER BY created_at DESC
  LIMIT 1;

  -- Already active or pending → no-op return
  IF FOUND AND v_rel.ended_at IS NULL AND v_rel.status IN ('active','pending') THEN
    RETURN jsonb_build_object(
      'relationship_id', v_rel.id,
      'status', v_rel.status,
      'reactivated', false
    );
  END IF;

  -- Existing ended/inactive/declined row → revive in place
  IF FOUND THEN
    v_new_status := CASE WHEN v_rel.client_id IS NOT NULL THEN 'active' ELSE 'pending' END;
    UPDATE public.client_agent_relationships
       SET status = v_new_status,
           ended_at = NULL,
           crm_client_id = COALESCE(crm_client_id, p_crm_client_id)
     WHERE id = v_rel.id;
    RETURN jsonb_build_object(
      'relationship_id', v_rel.id,
      'status', v_new_status,
      'reactivated', true
    );
  END IF;

  -- No prior relationship → fresh pending row tied to crm_client_id
  INSERT INTO public.client_agent_relationships
    (agent_id, client_id, crm_client_id, status)
  VALUES
    (v_agent, NULL, p_crm_client_id, 'pending')
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'relationship_id', v_new_id,
    'status', 'pending',
    'reactivated', true
  );
END;
$function$;

-- 2) New canonical by-id remove that mirrors agent_end_client_relationship cleanup
--    (hot sheet cascade + invite-token revocation + status flip), so the Contacts
--    entry point and the buyer-detail entry point behave identically.
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

  -- Resolve email for token matching (CRM contact preferred; fall back to auth profile)
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

  -- Hot sheets owned by this agent for this CRM contact
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

  -- Revoke outstanding invite tokens
  UPDATE public.share_tokens
     SET revoked_at = now()
   WHERE agent_id = v_agent
     AND accepted_at IS NULL
     AND revoked_at IS NULL
     AND (
       (v_crm_client_id IS NOT NULL AND (payload->>'client_id') = v_crm_client_id::text)
       OR (v_client_email IS NOT NULL AND lower(payload->>'client_email') = v_client_email)
     );

  -- End the relationship
  UPDATE public.client_agent_relationships
     SET status = 'inactive',
         ended_at = now()
   WHERE id = p_relationship_id
     AND ended_at IS NULL;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  -- If already ended, treat as idempotent success (return 0)
  RETURN rows_affected;
END;
$function$;
