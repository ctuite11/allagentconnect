CREATE OR REPLACE FUNCTION public.resolve_or_create_agent_contact(
  p_email text,
  p_first_name text,
  p_last_name text DEFAULT '',
  p_phone text DEFAULT NULL,
  p_client_type text DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS TABLE(contact_id uuid, created boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
BEGIN
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'A valid email is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_agent::text || '|' || v_email));

  SELECT c.id INTO v_id
  FROM public.clients c
  WHERE c.agent_id = v_agent AND lower(trim(c.email)) = v_email
  ORDER BY c.created_at
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, false;
    RETURN;
  END IF;

  IF EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE lower(trim(p.email)) = v_email AND p.id <> v_agent
     )
     OR EXISTS (
       SELECT 1
       FROM public.client_agent_relationships car
       JOIN public.clients c ON c.id = car.client_id
       WHERE lower(trim(c.email)) = v_email
         AND car.status = 'active'
         AND car.ended_at IS NULL
         AND car.agent_id <> v_agent
     ) THEN
    RAISE EXCEPTION 'This email is associated with another member and cannot be added.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.clients (agent_id, agent_user_id, first_name, last_name, email, phone, client_type, source)
  VALUES (
    v_agent,
    CASE WHEN p_client_type = 'buyer' THEN v_agent ELSE NULL END,
    coalesce(nullif(trim(p_first_name), ''), ''),
    coalesce(trim(p_last_name), ''),
    v_email,
    nullif(trim(coalesce(p_phone, '')), ''),
    p_client_type,
    coalesce(p_source, 'manual')
  )
  ON CONFLICT (agent_id, lower(email)) WHERE email IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT c.id INTO v_id FROM public.clients c
    WHERE c.agent_id = v_agent AND lower(c.email) = v_email LIMIT 1;
    RETURN QUERY SELECT v_id, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_id, true;
END;
$$;