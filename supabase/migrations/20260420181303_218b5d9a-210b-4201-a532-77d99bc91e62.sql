CREATE OR REPLACE FUNCTION public.activate_agent_relationship(_agent_id uuid, _crm_client_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _client_id uuid;
  _resolved_crm_client_id uuid;
  _existing_id uuid;
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

  -- End any OTHER active relationships for this buyer (one-active-agent rule),
  -- but DO NOT touch a row already matching (this agent, this crm_client) -- we'll reuse it.
  UPDATE public.client_agent_relationships
  SET status = 'inactive',
      ended_at = now()
  WHERE client_id = _client_id
    AND ended_at IS NULL
    AND status = 'active'
    AND NOT (
      agent_id = _agent_id
      AND COALESCE(crm_client_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(_resolved_crm_client_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

  -- Strategy: locate an existing row by the strongest available key, then update it in place.
  -- 1) Active row for this (agent, crm_client) pair (protected by car_unique_active_agent_crm)
  IF _resolved_crm_client_id IS NOT NULL THEN
    SELECT id INTO _existing_id
    FROM public.client_agent_relationships
    WHERE agent_id = _agent_id
      AND crm_client_id = _resolved_crm_client_id
      AND ended_at IS NULL
    LIMIT 1;
  END IF;

  -- 2) Any row for this (client_id, agent_id) pair (protected by client_agent_relationships_client_id_agent_id_key)
  IF _existing_id IS NULL THEN
    SELECT id INTO _existing_id
    FROM public.client_agent_relationships
    WHERE client_id = _client_id
      AND agent_id = _agent_id
    ORDER BY (status = 'active') DESC, created_at DESC
    LIMIT 1;
  END IF;

  -- 3) Any inactive/ended row for this (agent, crm_client) pair we can revive
  IF _existing_id IS NULL AND _resolved_crm_client_id IS NOT NULL THEN
    SELECT id INTO _existing_id
    FROM public.client_agent_relationships
    WHERE agent_id = _agent_id
      AND crm_client_id = _resolved_crm_client_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF _existing_id IS NOT NULL THEN
    -- Reactivate / refresh in place. Idempotent on the active pair.
    UPDATE public.client_agent_relationships
    SET status = 'active',
        ended_at = NULL,
        client_id = _client_id,
        crm_client_id = COALESCE(_resolved_crm_client_id, crm_client_id)
    WHERE id = _existing_id;
    RETURN _existing_id;
  END IF;

  -- No prior row exists -- insert fresh
  INSERT INTO public.client_agent_relationships
    (client_id, agent_id, status, created_at, ended_at, crm_client_id)
  VALUES
    (_client_id, _agent_id, 'active', now(), NULL, _resolved_crm_client_id)
  RETURNING id INTO _existing_id;

  RETURN _existing_id;
END;
$function$;