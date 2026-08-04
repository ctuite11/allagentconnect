-- Read-only: Agent Network RPC vs Comms base population vs legacy rule.
-- No writes. Safe to run against production.

-- 1) Counts
WITH network AS (SELECT user_id FROM public.get_verified_agent_ids()),
legacy AS (
  SELECT s.user_id
  FROM public.agent_settings s
  JOIN public.user_roles r ON r.user_id = s.user_id AND r.role = 'agent'
  LEFT JOIN public.agent_profiles p ON p.id = s.user_id
  WHERE s.agent_status = 'verified'
    AND (s.account_activated_at IS NOT NULL OR COALESCE(NULLIF(TRIM(p.headshot_url), ''), NULL) IS NOT NULL)
)
SELECT
  (SELECT count(*) FROM network) AS network_count,
  (SELECT count(*) FROM network) AS comms_base_count, -- comms base IS the RPC
  (SELECT count(*) FROM legacy)  AS legacy_rule_count,
  (SELECT count(*) FROM legacy WHERE user_id NOT IN (SELECT user_id FROM network)) AS legacy_only,
  (SELECT count(*) FROM network WHERE user_id NOT IN (SELECT user_id FROM legacy)) AS network_only;

-- 2) Drift detail: agents the legacy rule included but the Network does not.
WITH network AS (SELECT user_id FROM public.get_verified_agent_ids())
SELECT p.id, p.email, p.first_name, p.last_name, s.agent_status, s.account_activated_at
FROM public.agent_settings s
JOIN public.user_roles r ON r.user_id = s.user_id AND r.role = 'agent'
LEFT JOIN public.agent_profiles p ON p.id = s.user_id
WHERE s.agent_status = 'verified'
  AND s.user_id NOT IN (SELECT user_id FROM network)
ORDER BY p.last_name NULLS LAST, p.email;
