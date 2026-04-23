
UPDATE public.share_tokens st
SET revoked_at = now()
WHERE st.accepted_at IS NULL
  AND st.revoked_at IS NULL
  AND (st.payload->>'type') = 'client_hotsheet_invite'
  AND (st.payload->>'client_id') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.client_agent_relationships r
    WHERE r.crm_client_id = (st.payload->>'client_id')::uuid
      AND r.agent_id = st.agent_id
      AND r.ended_at IS NULL
      AND r.status IN ('active','pending')
  );
