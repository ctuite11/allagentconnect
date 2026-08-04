-- ============================================================================
-- GROUP A ACTIVATION RECONCILIATION — 2026-08-04
-- Read-only. Run in the Supabase SQL editor on production.
--
-- Purpose: separate the six "signed in but account_activated_at IS NULL"
-- accounts into:
--   1) Setup completion proven  (redeemed activation token + evidence)
--   2) Signed in, setup completion not proven
--
-- Also explain the count drift:
--   Prior snapshot: 202 eligible / 102 verified-but-unactivated
--   Later snapshot: 203 eligible / 103 held out / 306 total
--   (eligible + held-out = 306 under the old company-fallback population)
--
-- Rules for this audit:
--   * Do NOT treat last_sign_in_at alone as setup completion.
--   * Do NOT treat company / headshot / approval email as activation.
--   * Durable setup proof = agent_activation_tokens.redeemed_at IS NOT NULL
--     (token status redeemed), optionally corroborated by /agent-setup
--     mark_agent_activated having failed to stick (still null).
--   * recovery_sent_at is auth.users (GoTrue), not agent_settings.
--
-- Do NOT UPDATE / INSERT / DELETE / activate / purge / email.
-- ============================================================================

-- Fixed candidate set from Lovable Group A (verified + signed in + not activated).
-- Patricia Burns and Maria Renda are the only ones Lovable marked as token-redeemed.
CREATE TEMP TABLE group_a_candidates (
  expected_name text NOT NULL,
  expected_email text PRIMARY KEY,
  known_user_id uuid,
  lovable_token_redeemed_claim boolean NOT NULL
);

INSERT INTO group_a_candidates (expected_name, expected_email, known_user_id, lovable_token_redeemed_claim) VALUES
  ('Patricia Burns', 'patburns@leadingedgeagents.com', 'b01352e3-1cef-4289-8927-e2cecb666803', true),
  ('Maria Renda', 'maria@truenorthbostonrealty.com', '7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca', true),
  ('Kristin Gennetti Aylward', 'kristingennetti@gmail.com', NULL, false),
  ('Shari Jacobson', 'shari.jacobson@cbrealty.com', NULL, false),
  ('Sheri Flagler', 'sheri.flagler@cbrealty.com', NULL, false),
  ('Steve Facelle', 'steve.facelle@raveis.com', NULL, false);

-- Resolve user_id: prefer known UUID, else agent_profiles.email, else auth.users.email.
CREATE TEMP TABLE group_a_resolved AS
SELECT
  c.expected_name,
  c.expected_email,
  c.lovable_token_redeemed_claim,
  coalesce(
    c.known_user_id,
    (
      SELECT ap.id
      FROM public.agent_profiles ap
      WHERE lower(btrim(ap.email)) = lower(c.expected_email)
      LIMIT 1
    ),
    (
      SELECT u.id
      FROM auth.users u
      WHERE lower(u.email) = lower(c.expected_email)
      LIMIT 1
    )
  ) AS user_id
FROM group_a_candidates c;

DO $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing FROM group_a_resolved WHERE user_id IS NULL;
  IF missing > 0 THEN
    RAISE NOTICE 'Unresolved Group A emails: %', missing;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. PER-ACCOUNT RECONCILIATION
-- ----------------------------------------------------------------------------
WITH latest_token AS (
  SELECT DISTINCT ON (t.user_id)
    t.user_id,
    t.id AS activation_token_id,
    t.status AS activation_token_status,
    t.created_at AS activation_token_created_at,
    t.expires_at AS activation_token_expires_at,
    t.redeemed_at,
    t.redeeming_at,
    t.revoked_at
  FROM public.agent_activation_tokens t
  JOIN group_a_resolved c ON c.user_id = t.user_id
  ORDER BY t.user_id, t.created_at DESC NULLS LAST
),
any_redeemed AS (
  SELECT
    t.user_id,
    bool_or(t.status = 'redeemed' AND t.redeemed_at IS NOT NULL) AS has_redeemed_activation_token,
    min(t.redeemed_at) FILTER (WHERE t.status = 'redeemed') AS first_redeemed_at,
    max(t.redeemed_at) FILTER (WHERE t.status = 'redeemed') AS latest_redeemed_at,
    count(*) FILTER (WHERE t.status = 'redeemed') AS redeemed_token_count,
    count(*) AS activation_token_row_count
  FROM public.agent_activation_tokens t
  JOIN group_a_resolved c ON c.user_id = t.user_id
  GROUP BY t.user_id
),
auth_methods AS (
  SELECT
    i.user_id,
    string_agg(DISTINCT i.provider, ', ' ORDER BY i.provider) AS auth_providers,
    max(i.created_at) AS latest_identity_created_at
  FROM auth.identities i
  JOIN group_a_resolved c ON c.user_id = i.user_id
  GROUP BY i.user_id
),
network AS (
  SELECT
    s.user_id,
    (
      EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id)
      AND EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = s.user_id AND r.role = 'agent'::public.app_role
      )
      AND EXISTS (SELECT 1 FROM public.agent_profiles ap WHERE ap.id = s.user_id)
      AND s.agent_status = 'verified'::public.agent_status
      AND s.account_activated_at IS NOT NULL
      AND s.hide_from_directory = false
      AND btrim(coalesce((SELECT first_name FROM public.agent_profiles WHERE id = s.user_id), '')) <> ''
      AND btrim(coalesce((SELECT last_name FROM public.agent_profiles WHERE id = s.user_id), '')) <> ''
    ) AS passes_corrected_network_rule,
    (
      s.agent_status = 'verified'::public.agent_status
      AND s.hide_from_directory = false
      AND public.has_role(s.user_id, 'agent'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.agent_profiles ap
        WHERE ap.id = s.user_id
          AND btrim(coalesce(ap.first_name, '')) <> ''
          AND btrim(coalesce(ap.last_name, '')) <> ''
          AND (
            s.account_activated_at IS NOT NULL
            OR btrim(coalesce(ap.company, '')) <> ''
          )
      )
    ) AS passes_legacy_company_fallback_rule
  FROM public.agent_settings s
  JOIN group_a_resolved c ON c.user_id = s.user_id
)
SELECT
  c.expected_name AS name,
  coalesce(nullif(btrim(ap.email), ''), u.email, c.expected_email) AS email,
  c.user_id,
  (coalesce(ar.activation_token_row_count, 0) > 0) AS activation_token_exists,
  coalesce(ar.activation_token_row_count, 0) AS activation_token_row_count,
  lt.activation_token_id AS latest_token_id,
  lt.activation_token_status AS latest_token_status,
  coalesce(ar.has_redeemed_activation_token, false) AS has_redeemed_activation_token,
  ar.first_redeemed_at,
  ar.latest_redeemed_at AS activation_token_redeemed_at,
  u.recovery_sent_at,
  u.last_sign_in_at,
  u.created_at AS auth_created_at,
  (u.encrypted_password IS NOT NULL AND length(u.encrypted_password) > 0) AS password_hash_present,
  am.auth_providers AS authentication_method,
  s.onboarding_completed,
  s.onboarding_started,
  s.tour_completed,
  s.verified_at,
  s.account_activated_at,
  s.agent_status::text AS agent_status,
  s.hide_from_directory,
  n.passes_corrected_network_rule AS currently_network_eligible_corrected_rule,
  n.passes_legacy_company_fallback_rule AS would_match_legacy_company_rule,
  CASE
    WHEN coalesce(ar.has_redeemed_activation_token, false)
      AND u.last_sign_in_at IS NOT NULL
      THEN '1_setup_completion_proven'
    ELSE '2_signed_in_setup_not_proven'
  END AS reconciliation_bucket,
  c.lovable_token_redeemed_claim,
  CASE
    WHEN coalesce(ar.has_redeemed_activation_token, false)
      THEN ar.latest_redeemed_at
    ELSE NULL
  END AS recommended_account_activated_at_if_approved
FROM group_a_resolved c
LEFT JOIN public.agent_profiles ap ON ap.id = c.user_id
LEFT JOIN public.agent_settings s ON s.user_id = c.user_id
LEFT JOIN auth.users u ON u.id = c.user_id
LEFT JOIN latest_token lt ON lt.user_id = c.user_id
LEFT JOIN any_redeemed ar ON ar.user_id = c.user_id
LEFT JOIN auth_methods am ON am.user_id = c.user_id
LEFT JOIN network n ON n.user_id = c.user_id
ORDER BY reconciliation_bucket, name;

-- Bucket totals for the six
WITH latest AS (
  SELECT
    c.user_id,
    EXISTS (
      SELECT 1 FROM public.agent_activation_tokens t
      WHERE t.user_id = c.user_id
        AND t.status = 'redeemed'
        AND t.redeemed_at IS NOT NULL
    ) AS has_redeemed,
    u.last_sign_in_at
  FROM group_a_resolved c
  LEFT JOIN auth.users u ON u.id = c.user_id
)
SELECT
  CASE
    WHEN has_redeemed AND last_sign_in_at IS NOT NULL THEN '1_setup_completion_proven'
    ELSE '2_signed_in_setup_not_proven'
  END AS reconciliation_bucket,
  count(*) AS accounts
FROM latest
GROUP BY 1
ORDER BY 1;

-- ----------------------------------------------------------------------------
-- 2. COUNT DRIFT RECONCILIATION (202/102 → 203/103/306)
-- ----------------------------------------------------------------------------
-- Under old company-fallback rule (individuals only):
WITH old_pop AS (
  SELECT
    s.user_id,
    ap.first_name,
    ap.last_name,
    coalesce(nullif(btrim(ap.email), ''), u.email) AS email,
    s.account_activated_at,
    s.verified_at,
    ap.created_at AS profile_created_at,
    u.created_at AS auth_created_at,
    (
      EXISTS (SELECT 1 FROM auth.users au WHERE au.id = s.user_id)
      AND s.account_activated_at IS NOT NULL
      AND s.hide_from_directory = false
      AND public.has_role(s.user_id, 'agent'::public.app_role)
      AND btrim(coalesce(ap.first_name, '')) <> ''
      AND btrim(coalesce(ap.last_name, '')) <> ''
    ) AS passes_corrected
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
totals AS (
  SELECT
    count(*)::int AS current_old_rule_total,
    count(*) FILTER (WHERE passes_corrected)::int AS current_corrected_eligible,
    count(*) FILTER (WHERE NOT passes_corrected)::int AS current_held_out
  FROM old_pop
)
SELECT
  current_old_rule_total,
  current_corrected_eligible,
  current_held_out,
  306 AS prior_stated_total,
  203 AS prior_stated_eligible,
  103 AS prior_stated_held_out,
  202 AS earlier_stated_eligible,
  102 AS earlier_stated_held_out,
  current_old_rule_total - 306 AS delta_total_vs_306,
  current_corrected_eligible - 203 AS delta_eligible_vs_203,
  current_held_out - 103 AS delta_held_out_vs_103,
  current_corrected_eligible - 202 AS delta_eligible_vs_202,
  current_held_out - 102 AS delta_held_out_vs_102
FROM totals;

-- Candidates who likely entered between the 202/102 and 203/103/306 snapshots:
-- recently verified or recently created profiles still in the old-rule population.
WITH old_pop AS (
  SELECT
    s.user_id,
    btrim(ap.first_name || ' ' || ap.last_name) AS name,
    coalesce(nullif(btrim(ap.email), ''), u.email) AS email,
    s.account_activated_at,
    s.verified_at,
    ap.created_at AS profile_created_at,
    u.created_at AS auth_created_at,
    u.last_sign_in_at,
    (
      EXISTS (SELECT 1 FROM auth.users au WHERE au.id = s.user_id)
      AND s.account_activated_at IS NOT NULL
    ) AS passes_corrected
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
)
SELECT
  user_id,
  name,
  email,
  passes_corrected,
  account_activated_at,
  verified_at,
  profile_created_at,
  auth_created_at,
  last_sign_in_at,
  GREATEST(
    coalesce(verified_at, 'epoch'::timestamptz),
    coalesce(profile_created_at, 'epoch'::timestamptz),
    coalesce(auth_created_at, 'epoch'::timestamptz),
    coalesce(account_activated_at, 'epoch'::timestamptz)
  ) AS entered_population_at
FROM old_pop
ORDER BY entered_population_at DESC NULLS LAST
LIMIT 20;

-- Approved teams (unchanged by activation gate; for display-tile context only)
SELECT count(*)::int AS approved_team_tiles
FROM public.teams
WHERE status = 'approved';
