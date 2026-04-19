-- Fix Remove Buyer path to end the exact relationship row for both pending and active buyers.
-- Adds explicit ended status support and a by-id RPC used by MyClients.

ALTER TABLE public.client_agent_relationships
  DROP CONSTRAINT IF EXISTS valid_relationship_status;

ALTER TABLE public.client_agent_relationships
  ADD CONSTRAINT valid_relationship_status
  CHECK (status IN ('active', 'pending', 'declined', 'inactive', 'ended'));

ALTER TABLE public.client_agent_relationships
  DROP CONSTRAINT IF EXISTS client_agent_relationships_status_linking_check;

ALTER TABLE public.client_agent_relationships
  ADD CONSTRAINT client_agent_relationships_status_linking_check
  CHECK (
    (status = 'active' AND client_id IS NOT NULL)
    OR (status = 'pending' AND client_id IS NULL AND crm_client_id IS NOT NULL)
    OR (status IN ('inactive', 'declined', 'ended'))
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.agent_end_client_relationship_by_id(p_relationship_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_affected bigint;
BEGIN
  UPDATE public.client_agent_relationships
  SET status = 'ended',
      ended_at = now()
  WHERE id = p_relationship_id
    AND agent_id = auth.uid()
    AND ended_at IS NULL
    AND status IN ('active', 'pending');

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'No active or pending relationship found for agent % with relationship id %.', auth.uid(), p_relationship_id;
  END IF;

  RETURN rows_affected;
END;
$$;
