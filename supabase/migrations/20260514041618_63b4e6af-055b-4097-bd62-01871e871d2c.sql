CREATE OR REPLACE FUNCTION public.ensure_conversation_participants_for_caller(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
  v_other uuid;
  v_listing uuid;
  v_linked boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT c.agent_a_id, c.agent_b_id, c.listing_id
  INTO v_a, v_b, v_listing
  FROM public.conversations c
  WHERE c.id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE = 'P0002';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_a AND auth.uid() IS DISTINCT FROM v_b THEN
    RAISE EXCEPTION 'Not a party on this conversation' USING ERRCODE = '42501';
  END IF;

  v_other := CASE WHEN v_a = auth.uid() THEN v_b ELSE v_a END;

  IF v_listing IS NOT NULL THEN
    v_linked := true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_agent_relationships car
    WHERE car.status IN ('active', 'pending')
      AND (
        (car.agent_id = auth.uid() AND car.client_id = v_other)
        OR (car.agent_id = v_other AND car.client_id = auth.uid())
      )
  ) THEN
    v_linked := true;
  END IF;

  IF NOT v_linked AND EXISTS (
    SELECT 1
    FROM public.client_agent_relationships car
    INNER JOIN public.clients cl ON cl.id = car.crm_client_id
    INNER JOIN public.profiles pf ON lower(btrim(pf.email)) = lower(btrim(cl.email))
    WHERE car.status IN ('active', 'pending')
      AND car.client_id IS NULL
      AND (
        (car.agent_id = auth.uid() AND pf.id = v_other)
        OR (car.agent_id = v_other AND pf.id = auth.uid())
      )
  ) THEN
    v_linked := true;
  END IF;

  IF NOT v_linked
     AND EXISTS (SELECT 1 FROM public.agent_profiles ap WHERE ap.id = auth.uid())
     AND EXISTS (SELECT 1 FROM public.agent_profiles ap WHERE ap.id = v_other)
  THEN
    v_linked := true;
  END IF;

  IF NOT v_linked THEN
    RAISE EXCEPTION 'No active agent-client link, peer-agent context, or listing-scoped thread for this conversation'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  SELECT p_conversation_id, x
  FROM (
    SELECT v_a AS x
    UNION ALL
    SELECT v_b
  ) s
  WHERE x IS NOT NULL
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
END;
$$;

ALTER FUNCTION public.ensure_conversation_participants_for_caller(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.ensure_conversation_participants_for_caller(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_conversation_participants_for_caller(uuid) TO authenticated;

COMMENT ON FUNCTION public.ensure_conversation_participants_for_caller(uuid) IS
  'Idempotent participant rows; caller must be agent_a or agent_b. Validates listing scope, CRM link, or peer agents before insert. INSERT ... ON CONFLICT DO NOTHING only.';