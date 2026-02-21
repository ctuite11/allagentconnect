
-- 1) Canonical 2-param RPC with auto-fill CRM client bridge
CREATE OR REPLACE FUNCTION public.activate_agent_relationship(
  _agent_id uuid,
  _crm_client_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _client_id uuid;
  new_id uuid;
  _resolved_crm_client_id uuid;
BEGIN
  _client_id := auth.uid();
  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Auto-fill CRM contact bridge if not provided
  _resolved_crm_client_id := _crm_client_id;

  IF _resolved_crm_client_id IS NULL THEN
    SELECT c.id INTO _resolved_crm_client_id
    FROM public.clients c
    JOIN public.profiles p
      ON lower(c.email) = lower(p.email)
    WHERE p.id = _client_id
      AND c.agent_id = _agent_id
    ORDER BY c.created_at DESC
    LIMIT 1;
  END IF;

  UPDATE public.client_agent_relationships
  SET status = 'inactive',
      ended_at = now()
  WHERE client_id = _client_id
    AND ended_at IS NULL
    AND status = 'active';

  INSERT INTO public.client_agent_relationships
    (client_id, agent_id, status, created_at, ended_at, crm_client_id)
  VALUES
    (_client_id, _agent_id, 'active', now(), NULL, _resolved_crm_client_id)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- 2) Legacy 1-param overload: delegate to canonical version
CREATE OR REPLACE FUNCTION public.activate_agent_relationship(_agent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.activate_agent_relationship(_agent_id, NULL);
END;
$$;
