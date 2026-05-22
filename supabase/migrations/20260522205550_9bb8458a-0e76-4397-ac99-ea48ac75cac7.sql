-- Update agent_end_client_relationship to also clear the 'buyer' classification
-- on the CRM contact, so removed buyers no longer show as Buyer in My Contacts.
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
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND (
      (payload->>'client_id') = p_client_id::text
      OR (
        v_client_email IS NOT NULL
        AND lower(payload->>'client_email') = v_client_email
      )
    );

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

  -- Clear the 'buyer' classification on the CRM contact for this agent so the
  -- removed buyer no longer appears as Buyer in My Contacts. The contact row
  -- itself is preserved.
  UPDATE public.clients
  SET client_type = NULL
  WHERE id = p_client_id
    AND agent_id = auth.uid()
    AND client_type = 'buyer';

  RETURN rows_affected;
END;
$function$;

-- Backfill: any contact still tagged as 'buyer' for an agent who no longer has
-- an active/pending relationship with them should be cleared.
UPDATE public.clients c
SET client_type = NULL
WHERE c.client_type = 'buyer'
  AND NOT EXISTS (
    SELECT 1 FROM public.client_agent_relationships r
    WHERE r.agent_id = c.agent_id
      AND r.ended_at IS NULL
      AND r.status IN ('active', 'pending')
      AND (r.crm_client_id = c.id OR r.client_id = c.id)
  );