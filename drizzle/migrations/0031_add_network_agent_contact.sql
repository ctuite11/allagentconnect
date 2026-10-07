-- Narrow exception to the locked duplicate-email rule: Agent Network flow only.
-- Caller passes a known AAC agent member id (never a typed email). Reuses the
-- caller's existing contact for that member; never exposes the member's email.
CREATE OR REPLACE FUNCTION public.add_network_agent_contact(p_member_id uuid)
RETURNS TABLE(contact_id uuid, created boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent uuid := auth.uid();
  v_member public.agent_profiles%ROWTYPE;
  v_email text;
  v_id uuid;
BEGIN
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_member_id IS NULL OR p_member_id = v_agent THEN
    RAISE EXCEPTION 'Invalid member' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_member FROM public.agent_profiles WHERE id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002';
  END IF;
  v_email := lower(trim(coalesce(v_member.email, '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'Member has no email' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_agent::text || '|' || v_email));

  SELECT c.id INTO v_id
  FROM public.clients c
  WHERE c.agent_id = v_agent
    AND (c.agent_user_id = p_member_id OR lower(trim(c.email)) = v_email)
  ORDER BY c.created_at
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, false;
    RETURN;
  END IF;

  INSERT INTO public.clients (agent_id, agent_user_id, first_name, last_name, email, phone, client_type, source)
  VALUES (v_agent, p_member_id, coalesce(v_member.first_name, ''), coalesce(v_member.last_name, ''),
          v_email, v_member.phone, 'agent', 'network')
  ON CONFLICT (agent_id, lower(email)) WHERE email IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT c.id INTO v_id FROM public.clients c
    WHERE c.agent_id = v_agent AND lower(trim(c.email)) = v_email LIMIT 1;
    RETURN QUERY SELECT v_id, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.add_network_agent_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_network_agent_contact(uuid) TO authenticated;