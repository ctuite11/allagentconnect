-- If a client has multiple active relationships, keep the newest and inactivate the rest
WITH ranked AS (
  SELECT
    id,
    client_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY client_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.client_agent_relationships
  WHERE status = 'active'
)
UPDATE public.client_agent_relationships r
SET
  status = 'inactive',
  ended_at = COALESCE(r.ended_at, now())
FROM ranked
WHERE r.id = ranked.id
  AND ranked.rn > 1;

-- Enforce one active relationship per client going forward
CREATE UNIQUE INDEX IF NOT EXISTS client_agent_relationships_one_active_per_client
ON public.client_agent_relationships (client_id)
WHERE status = 'active';