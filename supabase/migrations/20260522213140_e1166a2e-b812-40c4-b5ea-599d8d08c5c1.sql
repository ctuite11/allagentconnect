-- Harden buyer removal: revoke ALL hot sheet invite tokens for the buyer
-- (including previously accepted ones) so that re-adding the same buyer
-- requires a brand-new invite + acceptance.
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

  -- Revoke ALL hot sheet / workspace invite tokens for this buyer (whether
  -- pending or already accepted). Once a buyer is removed there must be no
  -- lingering invite history that would prevent a fresh invite later.
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

  RETURN rows_affected;
END;
$function$;

-- Backfill: revoke any hot sheet invite tokens whose referenced hot sheet
-- no longer exists, OR whose buyer no longer has an active/pending
-- relationship with the issuing agent. These are orphan tokens left over
-- from earlier buyer removals and they currently block fresh invites.
UPDATE public.share_tokens st
SET revoked_at = now()
WHERE st.revoked_at IS NULL
  AND (st.payload->>'type') = 'client_hotsheet_invite'
  AND (
    -- Hot sheet referenced in payload no longer exists
    (
      st.payload ? 'hot_sheet_id'
      AND (st.payload->>'hot_sheet_id') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.hot_sheets hs
        WHERE hs.id::text = st.payload->>'hot_sheet_id'
      )
    )
    OR
    -- Buyer (by client_id or email) has no active/pending relationship with this agent
    (
      NOT EXISTS (
        SELECT 1
        FROM public.client_agent_relationships r
        JOIN public.clients c
          ON (c.id = r.crm_client_id OR c.id = r.client_id)
        WHERE r.agent_id = st.agent_id
          AND r.ended_at IS NULL
          AND r.status IN ('active', 'pending')
          AND (
            (st.payload->>'client_id') = c.id::text
            OR lower(st.payload->>'client_email') = lower(c.email)
          )
      )
    )
  );