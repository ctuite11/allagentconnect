
-- ============================================================
-- Consolidated Fix: CRM↔Auth Bridge for Client Relationships
-- ============================================================

-- 0) Drop broken view first (it depends on tables/columns we change)
DROP VIEW IF EXISTS public.clients_with_relationship_status;

-- 1) Add crm_client_id bridge column (deterministic link to CRM contact)
ALTER TABLE public.client_agent_relationships
  ADD COLUMN IF NOT EXISTS crm_client_id uuid REFERENCES public.clients(id);

-- 2) Indexes + guardrails
CREATE INDEX IF NOT EXISTS car_agent_crm_idx
  ON public.client_agent_relationships (agent_id, crm_client_id);

CREATE INDEX IF NOT EXISTS car_agent_client_idx
  ON public.client_agent_relationships (agent_id, client_id);

CREATE UNIQUE INDEX IF NOT EXISTS car_unique_active_agent_crm
  ON public.client_agent_relationships (agent_id, crm_client_id)
  WHERE crm_client_id IS NOT NULL AND ended_at IS NULL;

-- 3) Backfill existing relationship rows using email bridge (fixed join)
UPDATE public.client_agent_relationships AS car
SET crm_client_id = sub.crm_id
FROM (
  SELECT car2.id AS rel_id, c.id AS crm_id
  FROM public.client_agent_relationships car2
  JOIN public.profiles p ON p.id = car2.client_id
  JOIN public.clients c
    ON c.agent_id = car2.agent_id
   AND c.email IS NOT NULL
   AND p.email IS NOT NULL
   AND lower(c.email) = lower(p.email)
  WHERE car2.crm_client_id IS NULL
) sub
WHERE car.id = sub.rel_id;

-- 4) Replace activate_agent_relationship RPC to persist crm_client_id at accept time
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
BEGIN
  _client_id := auth.uid();
  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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
    (_client_id, _agent_id, 'active', now(), NULL, _crm_client_id)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- 5) Replace agent_end_client_relationship RPC (accepts either UUID space)
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
  SET status = 'inactive',
      ended_at = now()
  WHERE agent_id = auth.uid()
    AND ended_at IS NULL
    AND status = 'active'
    AND (client_id = p_client_id OR crm_client_id = p_client_id);

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'No active relationship found for agent % with identifier %.', auth.uid(), p_client_id;
  END IF;

  RETURN rows_affected;
END;
$$;

-- 6) Recreate deterministic view
CREATE OR REPLACE VIEW public.clients_with_relationship_status AS
SELECT
  c.*,
  r.ended_at   AS relationship_ended_at,
  r.created_at AS relationship_created_at,
  r.client_id  AS relationship_user_id,
  CASE
    WHEN r.id IS NULL THEN 'none'
    WHEN r.ended_at IS NULL THEN 'active'
    ELSE 'ended'
  END AS relationship_status
FROM public.clients c
LEFT JOIN LATERAL (
  SELECT *
  FROM public.client_agent_relationships r
  WHERE r.crm_client_id = c.id
    AND r.agent_id = c.agent_id
  ORDER BY r.created_at DESC
  LIMIT 1
) r ON true;

ALTER VIEW public.clients_with_relationship_status
  SET (security_invoker = on);
