
-- View: clients + relationship status from client_agent_relationships
-- Uses DISTINCT ON to pick the latest relationship row per (client_id, agent_id)
CREATE OR REPLACE VIEW public.clients_with_relationship_status AS
SELECT
  c.*,
  car.ended_at   AS relationship_ended_at,
  car.created_at AS relationship_created_at,
  CASE
    WHEN car.client_id IS NULL THEN 'none'
    WHEN car.status = 'active'  THEN 'active'
    ELSE 'ended'
  END AS relationship_status
FROM public.clients c
LEFT JOIN LATERAL (
  SELECT *
  FROM public.client_agent_relationships r
  WHERE r.client_id = c.id
    AND r.agent_id  = c.agent_id
  ORDER BY r.created_at DESC
  LIMIT 1
) car ON true;
