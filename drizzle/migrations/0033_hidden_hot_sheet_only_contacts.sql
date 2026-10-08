ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS hidden_from_contacts boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.clients.hidden_from_contacts IS 'Hot-Sheet-only contact (agent chose "No" on Save to contacts). Excluded from normal contact lists/counts; promoted to visible only by an explicit save.';

CREATE OR REPLACE VIEW public.clients_with_relationship_status WITH (security_invoker=on) AS
 SELECT c.id, c.agent_id, c.first_name, c.last_name, c.email, c.phone, c.notes, c.created_at, c.updated_at,
    c.client_type, c.is_favorite,
    r.ended_at AS relationship_ended_at, r.created_at AS relationship_created_at, r.client_id AS relationship_user_id,
    CASE WHEN r.id IS NULL THEN 'none'::text WHEN r.ended_at IS NULL THEN 'active'::text ELSE 'ended'::text END AS relationship_status,
    c.hidden_from_contacts
   FROM public.clients c
     LEFT JOIN LATERAL (SELECT r_1.id, r_1.client_id, r_1.created_at, r_1.ended_at
           FROM public.client_agent_relationships r_1
          WHERE r_1.crm_client_id = c.id AND r_1.agent_id = c.agent_id
          ORDER BY r_1.created_at DESC LIMIT 1) r ON true;

DROP FUNCTION IF EXISTS public.resolve_or_create_agent_contact(text, text, text, text, text, text);

CREATE FUNCTION public.resolve_or_create_agent_contact(p_email text, p_first_name text, p_last_name text DEFAULT ''::text, p_phone text DEFAULT NULL::text, p_client_type text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_hidden boolean DEFAULT false)
 RETURNS TABLE(contact_id uuid, created boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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

  SELECT c.id INTO v_id FROM public.clients c
  WHERE c.agent_id = v_agent AND lower(trim(c.email)) = v_email
  ORDER BY c.created_at LIMIT 1;
  IF v_id IS NOT NULL THEN
    -- Explicit (non-hidden) save promotes a Hot-Sheet-only contact; never demote.
    IF NOT coalesce(p_hidden, false) THEN
      UPDATE public.clients SET hidden_from_contacts = false, updated_at = now()
      WHERE id = v_id AND hidden_from_contacts;
    END IF;
    RETURN QUERY SELECT v_id, false;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE lower(trim(p.email)) = v_email AND p.id <> v_agent)
     OR EXISTS (
       SELECT 1 FROM public.client_agent_relationships car
       JOIN public.clients c ON c.id = car.client_id
       WHERE lower(trim(c.email)) = v_email AND car.status = 'active' AND car.ended_at IS NULL AND car.agent_id <> v_agent
     ) THEN
    RAISE EXCEPTION 'This email is associated with another member and cannot be added.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.clients (agent_id, agent_user_id, first_name, last_name, email, phone, client_type, source, hidden_from_contacts)
  VALUES (
    v_agent,
    CASE WHEN p_client_type = 'buyer' THEN v_agent ELSE NULL END,
    coalesce(nullif(trim(p_first_name), ''), ''),
    coalesce(trim(p_last_name), ''),
    v_email,
    nullif(trim(coalesce(p_phone, '')), ''),
    p_client_type,
    coalesce(p_source, 'manual'),
    coalesce(p_hidden, false)
  )
  ON CONFLICT (agent_id, lower(email)) WHERE email IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT c.id INTO v_id FROM public.clients c WHERE c.agent_id = v_agent AND lower(c.email) = v_email LIMIT 1;
    IF NOT coalesce(p_hidden, false) THEN
      UPDATE public.clients SET hidden_from_contacts = false WHERE id = v_id AND hidden_from_contacts;
    END IF;
    RETURN QUERY SELECT v_id, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_id, true;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_or_create_agent_contact(text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_or_create_agent_contact(text, text, text, text, text, text, boolean) TO authenticated, service_role;