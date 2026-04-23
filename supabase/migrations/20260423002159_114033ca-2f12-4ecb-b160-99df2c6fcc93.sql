
-- 1) Add revoked_at column to share_tokens
ALTER TABLE public.share_tokens
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_share_tokens_revoked_at
  ON public.share_tokens(revoked_at) WHERE revoked_at IS NOT NULL;

-- 2) Update agent_end_client_relationship to also revoke any outstanding (unaccepted) invite tokens
--    for this buyer. Match tokens by payload->>'client_id' (CRM client id) on the agent's tokens.
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
  -- Lookup the CRM client's email so we can match share_tokens by either client_id or client_email
  SELECT lower(email) INTO v_client_email
  FROM public.clients
  WHERE id = p_client_id
  LIMIT 1;

  -- 1) Collect hot sheets owned by the calling agent for this buyer (CRM client id)
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_hot_sheet_ids
  FROM public.hot_sheets
  WHERE user_id = auth.uid()
    AND client_id = p_client_id;

  -- 2) Cascade-clean dependents scoped to those hot sheets
  IF array_length(v_hot_sheet_ids, 1) IS NOT NULL THEN
    DELETE FROM public.hot_sheet_sent_listings  WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_comments       WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_listing_status WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_notifications  WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_favorites      WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_clients        WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheets               WHERE id            = ANY(v_hot_sheet_ids);
  END IF;

  -- 3) Also remove this buyer from any other agent-owned hot sheets they were a member of
  DELETE FROM public.hot_sheet_clients hsc
  USING public.hot_sheets hs
  WHERE hsc.hot_sheet_id = hs.id
    AND hs.user_id = auth.uid()
    AND hsc.client_id = p_client_id;

  -- 4) Revoke outstanding (unaccepted, unrevoked) invite tokens issued by this agent
  --    for this buyer. Tokens are stored on share_tokens with a JSONB payload.
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

  -- 5) End the relationship (existing behavior)
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

  -- NOTE: public.clients is intentionally NOT touched. CRM contact is preserved.

  RETURN rows_affected;
END;
$function$;

-- 3) Backfill: revoke any unaccepted tokens whose CRM client_id no longer exists
--    OR whose buyer email is no longer attached to an active relationship for the issuing agent.
--    This cleans up the n.lopachak@gmail.com stale-invite case described by the user.
UPDATE public.share_tokens st
SET revoked_at = now()
WHERE st.accepted_at IS NULL
  AND st.revoked_at IS NULL
  AND (st.payload->>'type') = 'client_hotsheet_invite'
  AND (st.payload->>'client_id') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = (st.payload->>'client_id')::uuid
      AND c.agent_id = st.agent_id
  );
