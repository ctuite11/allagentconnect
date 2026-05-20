-- Agent mirror: remove a buyer's generic MLS favorite (same auth as get_client_favorites_for_agent).

CREATE OR REPLACE FUNCTION public.remove_client_favorite_for_agent(
  p_favorite_id uuid,
  p_buyer_user_id uuid,
  p_crm_client_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_crm_client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = p_crm_client_id
        AND (
          (c.agent_user_id IS NOT NULL AND c.agent_user_id = p_buyer_user_id)
          OR (
            c.agent_user_id IS NULL
            AND c.email IS NOT NULL
            AND trim(c.email) <> ''
            AND EXISTS (
              SELECT 1
              FROM public.profiles p
              WHERE p.id = p_buyer_user_id
                AND lower(trim(p.email)) = lower(trim(c.email))
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'Buyer user does not match CRM client record';
    END IF;
  END IF;

  IF NOT (
    (p_crm_client_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = p_crm_client_id
        AND c.agent_id = auth.uid()
    ))
    OR (p_crm_client_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.client_agent_relationships car
      WHERE car.agent_id = auth.uid()
        AND car.crm_client_id = p_crm_client_id
        AND car.status = 'active'
        AND car.ended_at IS NULL
    ))
    OR EXISTS (
      SELECT 1
      FROM public.client_agent_relationships car
      WHERE car.agent_id = auth.uid()
        AND car.client_id = p_buyer_user_id
        AND car.status = 'active'
        AND car.ended_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'No active relationship with this client';
  END IF;

  DELETE FROM public.favorites f
  WHERE f.id = p_favorite_id
    AND f.user_id = p_buyer_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Favorite not found';
  END IF;
END;
$$;

ALTER FUNCTION public.remove_client_favorite_for_agent(uuid, uuid, uuid) OWNER TO postgres;

GRANT ALL ON FUNCTION public.remove_client_favorite_for_agent(uuid, uuid, uuid) TO anon;
GRANT ALL ON FUNCTION public.remove_client_favorite_for_agent(uuid, uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remove_client_favorite_for_agent(uuid, uuid, uuid) TO service_role;