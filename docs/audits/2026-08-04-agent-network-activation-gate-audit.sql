-- ============================================================================
-- AGENT NETWORK ACTIVATION GATE AUDIT — 2026-08-04
-- Read-only. Run in the Supabase SQL editor on production.
--
-- Reconstructs the CURRENT Agent Network individual population using the
-- live production rule (company fallback) and predicts who disappears under
-- the corrected activation-required rule (migration
-- 20260804090000_agent_network_require_activation.sql).
--
-- Teams are separate: OurAgents loads teams via teams.status = 'approved'
-- and does NOT use get_verified_agent_ids() for team tiles.
--
-- Do NOT treat company, headshot, or verification email as activation.
-- Do NOT UPDATE / DELETE / INSERT / activate / purge / send email.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. APPROVED TEAM TILES (unchanged by this migration)
-- ----------------------------------------------------------------------------
SELECT
  count(*) AS approved_team_tiles
FROM public.teams
WHERE status = 'approved';

SELECT
  id,
  name,
  slug,
  company,
  team_lead_user_id,
  updated_at
FROM public.teams
WHERE status = 'approved'
ORDER BY name;

-- ----------------------------------------------------------------------------
-- 1. DETAIL: every individual currently eligible under the OLD production rule
-- ----------------------------------------------------------------------------
WITH old_eligible AS (
  SELECT
    s.user_id,
    ap.first_name,
    ap.last_name,
    coalesce(nullif(btrim(ap.email), ''), u.email) AS email,
    (u.id IS NOT NULL) AS auth_user_exists,
    u.created_at AS auth_created_at,
    (u.encrypted_password IS NOT NULL AND length(u.encrypted_password) > 0) AS password_established,
    u.last_sign_in_at,
    EXISTS (
      SELECT 1
      FROM public.user_roles r
      WHERE r.user_id = s.user_id
        AND r.role = 'agent'::public.app_role
    ) AS agent_role_exists,
    s.agent_status::text AS agent_status,
    s.verified_at,
    s.account_activated_at,
    s.hide_from_directory,
    ap.company,
    (coalesce(btrim(ap.headshot_url), '') <> '') AS headshot_present,
    pv.id AS pending_verification_id,
    pv.created_at AS pending_verification_created_at,
    pv.status AS pending_verification_status
  FROM public.agent_settings s
  JOIN public.agent_profiles ap
    ON ap.id = s.user_id
  LEFT JOIN auth.users u
    ON u.id = s.user_id
  LEFT JOIN LATERAL (
    SELECT pv2.id, pv2.created_at, pv2.status
    FROM public.pending_verifications pv2
    WHERE pv2.user_id = s.user_id
       OR pv2.converted_user_id = s.user_id
       OR (
         coalesce(nullif(btrim(ap.email), ''), u.email) IS NOT NULL
         AND lower(pv2.email) = lower(coalesce(nullif(btrim(ap.email), ''), u.email))
       )
    ORDER BY pv2.created_at DESC NULLS LAST
    LIMIT 1
  ) pv ON true
  WHERE s.agent_status = 'verified'::public.agent_status
    AND s.hide_from_directory = false
    AND public.has_role(s.user_id, 'agent'::public.app_role)
    AND btrim(coalesce(ap.first_name, '')) <> ''
    AND btrim(coalesce(ap.last_name, '')) <> ''
    AND (
      s.account_activated_at IS NOT NULL
      OR btrim(coalesce(ap.company, '')) <> ''
    )
),
scored AS (
  SELECT
    o.*,
    (
      o.auth_user_exists
      AND o.agent_role_exists
      AND o.agent_status = 'verified'
      AND o.account_activated_at IS NOT NULL
      AND o.hide_from_directory = false
      AND btrim(coalesce(o.first_name, '')) <> ''
      AND btrim(coalesce(o.last_name, '')) <> ''
    ) AS passes_corrected_rule,
    CASE
      WHEN NOT o.auth_user_exists THEN 'missing_auth_user'
      WHEN NOT o.agent_role_exists THEN 'missing_agent_role'
      WHEN o.agent_status IS DISTINCT FROM 'verified' THEN 'not_verified'
      WHEN o.account_activated_at IS NULL THEN 'not_activated'
      WHEN o.hide_from_directory THEN 'hidden_from_directory'
      WHEN btrim(coalesce(o.first_name, '')) = ''
        OR btrim(coalesce(o.last_name, '')) = '' THEN 'missing_or_blank_name'
      ELSE NULL
    END AS exclusion_reason
  FROM old_eligible o
)
SELECT
  user_id,
  btrim(first_name || ' ' || last_name) AS name,
  email,
  auth_user_exists,
  auth_created_at,
  password_established,
  last_sign_in_at,
  agent_role_exists,
  agent_status,
  verified_at,
  account_activated_at,
  hide_from_directory,
  company,
  headshot_present,
  pending_verification_id,
  pending_verification_created_at,
  pending_verification_status,
  passes_corrected_rule,
  exclusion_reason
FROM scored
ORDER BY passes_corrected_rule ASC, last_name ASC, first_name ASC;

-- ----------------------------------------------------------------------------
-- 2. TOTALS
-- ----------------------------------------------------------------------------
WITH team_count AS (
  SELECT count(*)::int AS approved_team_tiles
  FROM public.teams
  WHERE status = 'approved'
),
old_eligible AS (
  SELECT s.user_id, ap.first_name, ap.last_name, ap.company, ap.headshot_url,
         s.account_activated_at, s.hide_from_directory, s.agent_status,
         (u.id IS NOT NULL) AS auth_user_exists,
         EXISTS (
           SELECT 1 FROM public.user_roles r
           WHERE r.user_id = s.user_id AND r.role = 'agent'::public.app_role
         ) AS agent_role_exists,
         (ap.id IS NOT NULL) AS has_profile
  FROM public.agent_settings s
  JOIN public.agent_profiles ap ON ap.id = s.user_id
  LEFT JOIN auth.users u ON u.id = s.user_id
  WHERE s.agent_status = 'verified'::public.agent_status
    AND s.hide_from_directory = false
    AND public.has_role(s.user_id, 'agent'::public.app_role)
    AND btrim(coalesce(ap.first_name, '')) <> ''
    AND btrim(coalesce(ap.last_name, '')) <> ''
    AND (
      s.account_activated_at IS NOT NULL
      OR btrim(coalesce(ap.company, '')) <> ''
    )
),
corrected AS (
  SELECT *
  FROM old_eligible o
  WHERE o.auth_user_exists
    AND o.agent_role_exists
    AND o.has_profile
    AND o.agent_status = 'verified'
    AND o.account_activated_at IS NOT NULL
    AND o.hide_from_directory = false
    AND btrim(coalesce(o.first_name, '')) <> ''
    AND btrim(coalesce(o.last_name, '')) <> ''
)
SELECT
  (SELECT approved_team_tiles FROM team_count)
    + (SELECT count(*)::int FROM old_eligible) AS current_displayed_network_tiles,
  (SELECT approved_team_tiles FROM team_count) AS approved_team_tiles,
  (SELECT count(*)::int FROM old_eligible) AS current_individual_agent_tiles,
  (SELECT count(*)::int FROM corrected) AS verified_plus_activated_individual_agents,
  (SELECT count(*)::int FROM old_eligible WHERE account_activated_at IS NULL)
    AS verified_but_unactivated_individual_agents,
  (SELECT count(*)::int FROM old_eligible WHERE NOT auth_user_exists) AS missing_auth_user,
  (SELECT count(*)::int FROM old_eligible WHERE NOT agent_role_exists) AS missing_agent_role,
  (SELECT count(*)::int FROM old_eligible WHERE NOT has_profile) AS missing_profile,
  (
    SELECT count(*)::int
    FROM public.agent_settings s
    JOIN public.agent_profiles ap ON ap.id = s.user_id
    WHERE s.agent_status = 'verified'::public.agent_status
      AND s.hide_from_directory = true
      AND public.has_role(s.user_id, 'agent'::public.app_role)
  ) AS hidden_agents_verified_with_role,
  (
    SELECT count(*)::int FROM old_eligible o
    WHERE o.auth_user_exists
      AND o.agent_role_exists
      AND o.account_activated_at IS NOT NULL
      AND NOT (
        btrim(coalesce(o.first_name, '')) <> ''
        AND btrim(coalesce(o.last_name, '')) <> ''
      )
  ) AS other_anomalies_activated_blank_name,
  (SELECT count(*)::int FROM corrected) AS expected_individual_agent_count_after_migration,
  (SELECT approved_team_tiles FROM team_count)
    + (SELECT count(*)::int FROM corrected) AS expected_total_displayed_tiles_after_migration;

-- ----------------------------------------------------------------------------
-- 3. CLEANUP CLASSIFICATION (no automatic repair)
--    Agents currently shown under the OLD rule who FAIL the corrected rule.
-- ----------------------------------------------------------------------------
WITH old_eligible AS (
  SELECT
    s.user_id,
    ap.first_name,
    ap.last_name,
    coalesce(nullif(btrim(ap.email), ''), u.email) AS email,
    (u.id IS NOT NULL) AS auth_user_exists,
    (u.encrypted_password IS NOT NULL AND length(u.encrypted_password) > 0) AS password_established,
    u.last_sign_in_at,
    EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = s.user_id AND r.role = 'agent'::public.app_role
    ) AS agent_role_exists,
    s.agent_status::text AS agent_status,
    s.account_activated_at,
    s.hide_from_directory,
    ap.company,
    EXISTS (
      SELECT 1 FROM public.deleted_users d
      WHERE d.original_user_id = s.user_id
         OR (
           coalesce(nullif(btrim(ap.email), ''), u.email) IS NOT NULL
           AND lower(d.email) = lower(coalesce(nullif(btrim(ap.email), ''), u.email))
         )
    ) AS matched_deleted_users_archive,
    (
      lower(coalesce(nullif(btrim(ap.email), ''), u.email, '')) ~ '(test|example|mailinator|fake)'
      OR lower(coalesce(ap.first_name, '')) IN ('test', 'demo', 'asdf')
    ) AS email_or_name_looks_like_test
  FROM public.agent_settings s
  JOIN public.agent_profiles ap ON ap.id = s.user_id
  LEFT JOIN auth.users u ON u.id = s.user_id
  WHERE s.agent_status = 'verified'::public.agent_status
    AND s.hide_from_directory = false
    AND public.has_role(s.user_id, 'agent'::public.app_role)
    AND btrim(coalesce(ap.first_name, '')) <> ''
    AND btrim(coalesce(ap.last_name, '')) <> ''
    AND (
      s.account_activated_at IS NOT NULL
      OR btrim(coalesce(ap.company, '')) <> ''
    )
),
failing AS (
  SELECT *
  FROM old_eligible o
  WHERE NOT (
    o.auth_user_exists
    AND o.agent_role_exists
    AND o.agent_status = 'verified'
    AND o.account_activated_at IS NOT NULL
    AND o.hide_from_directory = false
    AND btrim(coalesce(o.first_name, '')) <> ''
    AND btrim(coalesce(o.last_name, '')) <> ''
  )
),
classified AS (
  SELECT
    f.*,
    CASE
      WHEN f.matched_deleted_users_archive
        OR f.email_or_name_looks_like_test
        OR (NOT f.auth_user_exists AND f.user_id IS NOT NULL)
        THEN '4_duplicate_test_orphan_or_suspicious'
      WHEN NOT f.auth_user_exists
        OR NOT f.agent_role_exists
        OR f.agent_status IS DISTINCT FROM 'verified'
        THEN '3_missing_role_profile_settings_or_auth'
      WHEN f.password_established OR f.last_sign_in_at IS NOT NULL
        THEN '1_password_setup_appears_complete_missing_activation'
      ELSE '2_no_password_setup_evidence'
    END AS cleanup_group
  FROM failing f
)
SELECT
  cleanup_group,
  user_id,
  btrim(first_name || ' ' || last_name) AS name,
  email,
  auth_user_exists,
  password_established,
  last_sign_in_at,
  agent_role_exists,
  account_activated_at,
  company
FROM classified
ORDER BY cleanup_group, last_name, first_name;

-- Group counts
WITH old_eligible AS (
  SELECT
    s.user_id,
    ap.first_name,
    ap.last_name,
    coalesce(nullif(btrim(ap.email), ''), u.email) AS email,
    (u.id IS NOT NULL) AS auth_user_exists,
    (u.encrypted_password IS NOT NULL AND length(u.encrypted_password) > 0) AS password_established,
    u.last_sign_in_at,
    EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = s.user_id AND r.role = 'agent'::public.app_role
    ) AS agent_role_exists,
    s.agent_status::text AS agent_status,
    s.account_activated_at,
    s.hide_from_directory,
    EXISTS (
      SELECT 1 FROM public.deleted_users d
      WHERE d.original_user_id = s.user_id
         OR (
           coalesce(nullif(btrim(ap.email), ''), u.email) IS NOT NULL
           AND lower(d.email) = lower(coalesce(nullif(btrim(ap.email), ''), u.email))
         )
    ) AS matched_deleted_users_archive,
    (
      lower(coalesce(nullif(btrim(ap.email), ''), u.email, '')) ~ '(test|example|mailinator|fake)'
      OR lower(coalesce(ap.first_name, '')) IN ('test', 'demo', 'asdf')
    ) AS email_or_name_looks_like_test
  FROM public.agent_settings s
  JOIN public.agent_profiles ap ON ap.id = s.user_id
  LEFT JOIN auth.users u ON u.id = s.user_id
  WHERE s.agent_status = 'verified'::public.agent_status
    AND s.hide_from_directory = false
    AND public.has_role(s.user_id, 'agent'::public.app_role)
    AND btrim(coalesce(ap.first_name, '')) <> ''
    AND btrim(coalesce(ap.last_name, '')) <> ''
    AND (
      s.account_activated_at IS NOT NULL
      OR btrim(coalesce(ap.company, '')) <> ''
    )
),
failing AS (
  SELECT *
  FROM old_eligible o
  WHERE NOT (
    o.auth_user_exists
    AND o.agent_role_exists
    AND o.agent_status = 'verified'
    AND o.account_activated_at IS NOT NULL
    AND o.hide_from_directory = false
    AND btrim(coalesce(o.first_name, '')) <> ''
    AND btrim(coalesce(o.last_name, '')) <> ''
  )
),
classified AS (
  SELECT
    CASE
      WHEN f.matched_deleted_users_archive
        OR f.email_or_name_looks_like_test
        OR (NOT f.auth_user_exists AND f.user_id IS NOT NULL)
        THEN '4_duplicate_test_orphan_or_suspicious'
      WHEN NOT f.auth_user_exists
        OR NOT f.agent_role_exists
        OR f.agent_status IS DISTINCT FROM 'verified'
        THEN '3_missing_role_profile_settings_or_auth'
      WHEN f.password_established OR f.last_sign_in_at IS NOT NULL
        THEN '1_password_setup_appears_complete_missing_activation'
      ELSE '2_no_password_setup_evidence'
    END AS cleanup_group
  FROM failing f
)
SELECT cleanup_group, count(*) AS agents
FROM classified
GROUP BY cleanup_group
ORDER BY cleanup_group;
