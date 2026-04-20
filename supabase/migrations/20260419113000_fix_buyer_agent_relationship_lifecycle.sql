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
    AND agent_id <> _agent_id
    AND ended_at IS NULL
    AND status = 'active';

  UPDATE public.client_agent_relationships
  SET status = 'active',
      ended_at = NULL,
      crm_client_id = COALESCE(_resolved_crm_client_id, crm_client_id)
  WHERE client_id = _client_id
    AND agent_id = _agent_id
  RETURNING id INTO new_id;

  IF new_id IS NOT NULL THEN
    RETURN new_id;
  END IF;

  WITH pending_match AS (
    SELECT id
    FROM public.client_agent_relationships
    WHERE agent_id = _agent_id
      AND client_id IS NULL
      AND status = 'pending'
      AND ended_at IS NULL
      AND crm_client_id IS NOT DISTINCT FROM _resolved_crm_client_id
    ORDER BY created_at DESC
    LIMIT 1
  )
  UPDATE public.client_agent_relationships car
  SET client_id = _client_id,
      status = 'active',
      ended_at = NULL,
      crm_client_id = COALESCE(_resolved_crm_client_id, car.crm_client_id)
  FROM pending_match
  WHERE car.id = pending_match.id
  RETURNING car.id INTO new_id;

  IF new_id IS NOT NULL THEN
    RETURN new_id;
  END IF;

  INSERT INTO public.client_agent_relationships
    (client_id, agent_id, status, created_at, ended_at, crm_client_id)
  VALUES
    (_client_id, _agent_id, 'active', now(), NULL, _resolved_crm_client_id)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

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
  SET status = 'ended',
      ended_at = now()
  WHERE client_id = auth.uid()
    AND ended_at IS NULL
    AND status IN ('active', 'pending');

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'No active or pending relationship found for user % to end.', auth.uid();
  END IF;

  RETURN rows_affected;
END;
$$;

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
  SET status = 'ended',
      ended_at = now()
  WHERE agent_id = auth.uid()
    AND ended_at IS NULL
    AND status IN ('active', 'pending')
    AND (client_id = p_client_id OR crm_client_id = p_client_id);

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'No active or pending relationship found for agent % with identifier %.', auth.uid(), p_client_id;
  END IF;

  RETURN rows_affected;
END;
$$;