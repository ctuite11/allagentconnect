-- ============================================================================
-- ORPHANED AUTH USERS AUDIT — 2026-07-17
-- Read-only. Run in the Supabase SQL editor on production.
--
-- Context: admin deletions previously removed application rows but could
-- leave the auth.users row behind (Yanis Benyamina, Billy Frack). The fix
-- (migration 20260718090000_atomic_auth_deletion_outbox.sql) adds a durable
-- deletion outbox; existing orphans are backfilled into it and purged by the
-- delete-users edge function via a pg_cron pump.
--
-- Run section 1 BEFORE applying the migration to capture the orphan list.
-- Run sections 3-5 AFTER to verify the purge.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FULL ORPHAN REPORT (read-only)
--    Every auth.users row that matches a deleted_users record by
--    original_user_id OR normalized email, with surviving app-row counts.
-- ----------------------------------------------------------------------------
SELECT
  u.id                                   AS auth_user_id,
  u.email                                AS auth_email,
  u.created_at                           AS auth_created_at,
  u.last_sign_in_at,
  d.original_user_id                     AS archived_user_id,
  d.email                                AS archived_email,
  d.first_name,
  d.last_name,
  d.deleted_at,
  d.deletion_reason,
  (d.original_user_id = u.id)            AS matched_by_id,
  (lower(d.email) = lower(u.email))      AS matched_by_email,
  (SELECT count(*) FROM public.profiles p        WHERE p.id = u.id)       AS profiles_rows,
  (SELECT count(*) FROM public.agent_profiles ap WHERE ap.id = u.id)      AS agent_profiles_rows,
  (SELECT count(*) FROM public.user_roles r      WHERE r.user_id = u.id)  AS user_roles_rows,
  (SELECT count(*) FROM public.agent_settings s  WHERE s.user_id = u.id)  AS agent_settings_rows,
  -- true orphan = archived + zero surviving identity rows + not re-registered
  (
    u.created_at <= d.deleted_at
    AND NOT EXISTS (SELECT 1 FROM public.profiles p        WHERE p.id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.agent_profiles ap WHERE ap.id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_roles r      WHERE r.user_id = u.id)
  ) AS is_confirmed_orphan
FROM auth.users u
JOIN public.deleted_users d
  ON d.original_user_id = u.id
  OR (u.email IS NOT NULL AND lower(d.email) = lower(u.email))
ORDER BY d.deleted_at DESC;

-- ----------------------------------------------------------------------------
-- 2. BILLY FRACK — current state (before purge)
-- ----------------------------------------------------------------------------
SELECT 'auth.users' AS tbl, count(*) FROM auth.users
  WHERE lower(email) IN (SELECT lower(email) FROM public.deleted_users
                         WHERE lower(first_name) = 'billy' AND lower(last_name) = 'frack')
UNION ALL
SELECT 'deleted_users archive', count(*) FROM public.deleted_users
  WHERE lower(first_name) = 'billy' AND lower(last_name) = 'frack';

-- ----------------------------------------------------------------------------
-- 3. DELETION QUEUE STATUS (after migration applied)
--    Backfilled orphans appear with source = 'orphan_backfill'.
--    The pg_cron pump (process-auth-deletion-queue, every 10 min) drains it.
-- ----------------------------------------------------------------------------
SELECT status, source, count(*)
FROM public.auth_user_deletion_queue
GROUP BY status, source
ORDER BY status, source;

-- Detail of anything still pending or abandoned (should trend to zero):
SELECT id, auth_user_id, email, status, attempts, last_error, created_at, updated_at
FROM public.auth_user_deletion_queue
WHERE status <> 'completed'
ORDER BY created_at;

-- ----------------------------------------------------------------------------
-- 4. FORCE AN IMMEDIATE DRAIN (optional, instead of waiting for cron)
-- ----------------------------------------------------------------------------
SELECT public.process_auth_deletion_queue();
-- Then re-run section 3 after ~30 seconds.

-- ----------------------------------------------------------------------------
-- 5. POST-PURGE VERIFICATION
--    Expected: zero rows (no auth user matching any archived deletion,
--    other than legitimately re-registered accounts created AFTER deleted_at).
-- ----------------------------------------------------------------------------
SELECT u.id, u.email, u.created_at, d.deleted_at
FROM auth.users u
JOIN public.deleted_users d
  ON d.original_user_id = u.id
  OR (u.email IS NOT NULL AND lower(d.email) = lower(u.email))
WHERE u.created_at <= d.deleted_at;

-- Billy Frack final check — every count should be 0 except the archive:
SELECT 'auth.users' AS tbl, count(*) FROM auth.users
  WHERE lower(email) IN (SELECT lower(email) FROM public.deleted_users
                         WHERE lower(first_name) = 'billy' AND lower(last_name) = 'frack')
UNION ALL
SELECT 'agent_profiles', count(*) FROM public.agent_profiles
  WHERE lower(email) IN (SELECT lower(email) FROM public.deleted_users
                         WHERE lower(first_name) = 'billy' AND lower(last_name) = 'frack')
UNION ALL
SELECT 'deleted_users archive (should be >= 1)', count(*) FROM public.deleted_users
  WHERE lower(first_name) = 'billy' AND lower(last_name) = 'frack';
