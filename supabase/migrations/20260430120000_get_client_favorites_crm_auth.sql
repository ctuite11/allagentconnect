-- get_client_favorites_for_agent: authorize like the success-hub buyer mirror (CRM clients row + agent),
-- not only legacy client_agent_relationships.client_id (auth uid).
-- Favorites remain keyed by auth: favorites.user_id = p_buyer_user_id.

DROP FUNCTION IF EXISTS public.get_client_favorites_for_agent(uuid);

CREATE OR REPLACE FUNCTION public.get_client_favorites_for_agent(
  p_buyer_user_id uuid,
  p_crm_client_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  listing_id uuid,
  created_at timestamptz,
  address text,
  city text,
  state text,
  zip_code text,
  price numeric,
  bedrooms integer,
  bathrooms numeric,
  square_feet integer,
  property_type text,
  photos jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Optional: ensure the auth id we read favorites for belongs to this CRM contact
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

  RETURN QUERY
  SELECT
    f.id,
    f.listing_id,
    f.created_at,
    l.address,
    l.city,
    l.state,
    l.zip_code,
    l.price,
    l.bedrooms,
    l.bathrooms,
    l.square_feet,
    l.property_type,
    l.photos
  FROM public.favorites f
  JOIN public.listings l ON l.id = f.listing_id
  WHERE f.user_id = p_buyer_user_id
  ORDER BY f.created_at DESC;
END;
$$;

ALTER FUNCTION public.get_client_favorites_for_agent(uuid, uuid) OWNER TO postgres;

GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(uuid, uuid) TO anon;
GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(uuid, uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(uuid, uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(uuid, uuid) TO sandbox_exec;
