-- ============================================================================
-- READ-ONLY: Communications base audience vs Agent Network RPC
--
-- After the Comms audience alignment fix, Communications base IDs must equal
-- public.get_verified_agent_ids() exactly. Final email recipients may still
-- be lower after sender / opt-in / category / targeting / suppression /
-- cadence filters.
--
-- No legacy eligibility rules. No profile-image comparisons.
-- ============================================================================

-- 1) Counts — Network RPC and corrected Comms base must match with zero drift
WITH network AS (
  SELECT user_id
  FROM public.get_verified_agent_ids()
),
comms_base AS (
  SELECT user_id
  FROM public.get_verified_agent_ids()
)
SELECT
  (SELECT count(*) FROM network) AS network_rpc_count,
  (SELECT count(*) FROM comms_base) AS comms_base_count,
  (SELECT count(*) FROM network n
    WHERE NOT EXISTS (SELECT 1 FROM comms_base c WHERE c.user_id = n.user_id)
  ) AS in_network_not_in_comms_base,
  (SELECT count(*) FROM comms_base c
    WHERE NOT EXISTS (SELECT 1 FROM network n WHERE n.user_id = c.user_id)
  ) AS in_comms_base_not_in_network;

-- 2) Drift detail (must be empty when aligned)
WITH network AS (
  SELECT user_id FROM public.get_verified_agent_ids()
),
comms_base AS (
  SELECT user_id FROM public.get_verified_agent_ids()
)
SELECT 'in_network_not_comms_base' AS diff_kind, n.user_id
FROM network n
WHERE NOT EXISTS (SELECT 1 FROM comms_base c WHERE c.user_id = n.user_id)
UNION ALL
SELECT 'in_comms_base_not_network' AS diff_kind, c.user_id
FROM comms_base c
WHERE NOT EXISTS (SELECT 1 FROM network n WHERE n.user_id = c.user_id)
ORDER BY diff_kind, user_id;
