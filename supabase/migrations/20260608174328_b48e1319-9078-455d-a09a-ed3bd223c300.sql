-- 1) Helper RPC: is this email already actively represented by a different agent?
CREATE OR REPLACE FUNCTION public.is_buyer_represented_by_other_agent(
  p_email text,
  p_self_agent_id uuid,
  p_self_crm_client_id uuid DEFAULT NULL
)
RETURNS TABLE(agent_id uuid, relationship_id uuid, status text, client_id uuid, crm_client_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH norm AS (
    SELECT lower(btrim(p_email)) AS email
  ),
  matching_clients AS (
    SELECT c.id FROM public.clients c, norm
    WHERE lower(btrim(c.email)) = norm.email
  ),
  matching_profiles AS (
    SELECT p.id FROM public.profiles p, norm
    WHERE lower(btrim(p.email)) = norm.email
  )
  SELECT r.agent_id, r.id AS relationship_id, r.status, r.client_id, r.crm_client_id
  FROM public.client_agent_relationships r
  WHERE r.ended_at IS NULL
    AND r.status IN ('active','pending')
    AND r.agent_id <> p_self_agent_id
    AND (
      r.crm_client_id IN (SELECT id FROM matching_clients)
      OR r.client_id   IN (SELECT id FROM matching_profiles)
    )
    AND (p_self_crm_client_id IS NULL OR r.crm_client_id IS DISTINCT FROM p_self_crm_client_id)
  ORDER BY (r.status = 'active') DESC, r.created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_buyer_represented_by_other_agent(text, uuid, uuid) TO authenticated, service_role;

-- 2) BEFORE INSERT/UPDATE trigger on client_agent_relationships
CREATE OR REPLACE FUNCTION public.enforce_one_active_agent_per_buyer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email      text;
  v_other_row  RECORD;
BEGIN
  IF NEW.ended_at IS NOT NULL OR NEW.status NOT IN ('active','pending') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = NEW.status
     AND OLD.ended_at IS NOT DISTINCT FROM NEW.ended_at
     AND OLD.client_id IS NOT DISTINCT FROM NEW.client_id
     AND OLD.crm_client_id IS NOT DISTINCT FROM NEW.crm_client_id
     AND OLD.agent_id = NEW.agent_id
  THEN
    RETURN NEW;
  END IF;

  v_email := NULL;
  IF NEW.crm_client_id IS NOT NULL THEN
    SELECT lower(btrim(email)) INTO v_email
      FROM public.clients
     WHERE id = NEW.crm_client_id;
  END IF;
  IF (v_email IS NULL OR v_email = '') AND NEW.client_id IS NOT NULL THEN
    SELECT lower(btrim(email)) INTO v_email
      FROM public.profiles
     WHERE id = NEW.client_id;
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  SELECT r.agent_id, r.status, r.id
    INTO v_other_row
  FROM public.client_agent_relationships r
  WHERE r.ended_at IS NULL
    AND r.status IN ('active','pending')
    AND r.agent_id <> NEW.agent_id
    AND (
      (NEW.client_id IS NOT NULL AND r.client_id = NEW.client_id)
      OR r.crm_client_id IN (
        SELECT c.id FROM public.clients c
        WHERE lower(btrim(c.email)) = v_email
      )
      OR r.client_id IN (
        SELECT p.id FROM public.profiles p
        WHERE lower(btrim(p.email)) = v_email
      )
    )
  ORDER BY (r.status = 'active') DESC, r.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'BUYER_ALREADY_REPRESENTED: % (other agent %, status %)',
      v_email, v_other_row.agent_id, v_other_row.status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_one_active_agent_per_buyer ON public.client_agent_relationships;
CREATE TRIGGER trg_enforce_one_active_agent_per_buyer
BEFORE INSERT OR UPDATE OF status, ended_at, client_id, crm_client_id, agent_id
ON public.client_agent_relationships
FOR EACH ROW
EXECUTE FUNCTION public.enforce_one_active_agent_per_buyer();

-- 3) One-off cleanup for tuite.chris11 stale pending row on agent ea18faa4
UPDATE public.client_agent_relationships
   SET status   = 'inactive',
       ended_at = COALESCE(ended_at, now())
 WHERE id = 'b018f0cf-ac16-403f-9a64-f149a560b1b4'
   AND ended_at IS NULL;

UPDATE public.share_tokens
   SET payload = COALESCE(payload, '{}'::jsonb)
                 || jsonb_build_object(
                      'revoked', true,
                      'revoked_at', now()::text,
                      'revoked_reason', 'buyer_already_represented'
                    )
 WHERE id = 'd9236042-7083-4fbd-b2d0-ede2ec2c92d6'
   AND accepted_at IS NULL;

-- 4) Global cleanup: end any pending relationship that conflicts with an existing active relationship under a different agent
WITH active_buyers AS (
  SELECT
    r.id            AS active_rel_id,
    r.agent_id      AS active_agent_id,
    r.client_id     AS active_client_id,
    r.crm_client_id AS active_crm_id,
    lower(btrim(COALESCE(c.email, p.email))) AS email
  FROM public.client_agent_relationships r
  LEFT JOIN public.clients  c ON c.id = r.crm_client_id
  LEFT JOIN public.profiles p ON p.id = r.client_id
  WHERE r.status = 'active'
    AND r.ended_at IS NULL
),
dupes AS (
  SELECT DISTINCT rel.id AS dup_rel_id
  FROM public.client_agent_relationships rel
  LEFT JOIN public.clients  dc ON dc.id = rel.crm_client_id
  LEFT JOIN public.profiles dp ON dp.id = rel.client_id
  JOIN active_buyers ab
    ON ab.active_agent_id <> rel.agent_id
   AND (
        (rel.client_id IS NOT NULL AND rel.client_id = ab.active_client_id)
     OR lower(btrim(COALESCE(dc.email, dp.email))) = ab.email
   )
  WHERE rel.status   = 'pending'
    AND rel.ended_at IS NULL
    AND ab.email IS NOT NULL
    AND ab.email <> ''
)
UPDATE public.client_agent_relationships r
   SET status   = 'inactive',
       ended_at = now()
  FROM dupes d
 WHERE r.id = d.dup_rel_id;