-- Atomic RPC: ends any existing active relationship and creates a new active one.
-- auth.uid() is the client — no client_id parameter to prevent impersonation.

CREATE OR REPLACE FUNCTION public.activate_agent_relationship(_agent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id uuid;
  new_id uuid;
BEGIN
  _client_id := auth.uid();
  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- End any existing active relationship (idempotent, safe with partial unique index)
  UPDATE public.client_agent_relationships
  SET status = 'inactive',
      ended_at = now()
  WHERE client_id = _client_id
    AND status = 'active';

  -- Insert new active relationship
  INSERT INTO public.client_agent_relationships (client_id, agent_id, status, created_at)
  VALUES (_client_id, _agent_id, 'active', now())
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- Lock down function execution (least privilege)
REVOKE ALL ON FUNCTION public.activate_agent_relationship(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_agent_relationship(uuid) TO authenticated;