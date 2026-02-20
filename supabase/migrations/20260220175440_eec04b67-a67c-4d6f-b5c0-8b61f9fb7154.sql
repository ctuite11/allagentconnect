
-- Client ends their own relationship
CREATE OR REPLACE FUNCTION public.end_client_relationship()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_affected bigint;
BEGIN
  UPDATE public.client_agent_relationships
  SET status = 'inactive', ended_at = now()
  WHERE client_id = auth.uid() AND status = 'active';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'No active relationship found for user % to end.', auth.uid();
  END IF;

  RETURN rows_affected;
END;
$$;

-- Agent ends a specific client relationship
CREATE OR REPLACE FUNCTION public.agent_end_client_relationship(p_client_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_affected bigint;
BEGIN
  UPDATE public.client_agent_relationships
  SET status = 'inactive', ended_at = now()
  WHERE agent_id = auth.uid() AND client_id = p_client_id AND status = 'active';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'No active relationship found for agent % with client % to end.', auth.uid(), p_client_id;
  END IF;

  RETURN rows_affected;
END;
$$;
