-- ============================================================================
-- READ-ONLY: Communications base audience vs Agent Network RPC
--
-- After the Comms audience alignment fix, Communications base IDs must equal
-- public.get_verified_agent_ids() exactly. Final email recipients may still
-- be lower after sender / opt-in / category / targeting / suppression /
-- cadence filters.
--
-- This audit also shows the LEGACY independent Comms rule for contrast:
--   verified + agent role + (activated OR non-empty headshot)
--   (deliberately ignored hide_from_directory)
-- ============================================================================

-- 1) Canonical Agent Network population vs corrected Comms base vs legacy
WITH network AS (
  SELECT user_id
  FROM public.get_verified_agent_ids()
),
comms_base AS (
  SELECT user_id
  FROM public.get_verified_agent_ids()
),
legacy_comms AS (
  SELECT s.user_id
  FROM public.agent_settings s
  JOIN public.user_roles r
    ON r.user_id = s.user_id
   AND r.role = 'agent'::public.app_role
  JOIN public.agent_profiles ap
    ON ap.id = s.user_id
  WHERE s.agent_status = 'verified'::public.agent_status
    AND (
      s.account_activated_at IS NOT NULL
      OR nullif(btrim(coalesce(ap.headshot_url, '')), '') IS NOT NULL
    )
)
SELECT
  (SELECT count(*) FROM network) AS network_rpc_count,
  (SELECT count(*) FROM comms_base) AS comms_base_count,
  (SELECT count(*) FROM legacy_comms) AS legacy_comms_count,
  (SELECT count(*) FROM network n
    WHERE NOT EXISTS (SELECT 1 FROM comms_base c WHERE c.user_id = n.user_id)
  ) AS in_network_not_in_comms_base,
  (SELECT count(*) FROM comms_base c
    WHERE NOT EXISTS (SELECT 1 FROM network n WHERE n.user_id = c.user_id)
  ) AS in_comms_base_not_in_network,
  (SELECT count(*) FROM network n
    WHERE NOT EXISTS (SELECT 1 FROM legacy_comms l WHERE l.user_id = n.user_id)
  ) AS in_network_not_in_legacy,
  (SELECT count(*) FROM legacy_comms l
    WHERE NOT EXISTS (SELECT 1 FROM network n WHERE n.user_id = l.user_id)
  ) AS in_legacy_not_in_network;

-- 2) Drift detail: Network RPC vs corrected Comms base (must be empty)
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

-- 3) Legacy-only extras (verified-with-headshot but not in Network)
WITH network AS (
  SELECT user_id FROM public.get_verified_agent_ids()
),
legacy_comms AS (
  SELECT s.user_id
  FROM public.agent_settings s
  JOIN public.user_roles r
    ON r.user_id = s.user_id
   AND r.role = 'agent'::public.app_role
  JOIN public.agent_profiles ap
    ON ap.id = s.user_id
  WHERE s.agent_status = 'verified'::public.agent_status
    AND (
      s.account_activated_at IS NOT NULL
      OR nullif(btrim(coalesce(ap.headshot_url, '')), '') IS NOT NULL
    )
)
SELECT
  l.user_id,
  btrim(ap.first_name || ' ' || ap.last_name) AS name,
  ap.email,
  s.account_activated_at,
  nullif(btrim(coalesce(ap.headshot_url, '')), '') IS NOT NULL AS has_headshot,
  s.hide_from_directory
FROM legacy_comms l
JOIN public.agent_settings s ON s.user_id = l.user_id
JOIN public.agent_profiles ap ON ap.id = l.user_id
WHERE NOT EXISTS (SELECT 1 FROM network n WHERE n.user_id = l.user_id)
ORDER BY name;
