-- Database migration already applied.
-- Retained as a controlled initialization reference; excluded from the
-- current application-release procedure. Do not rerun during routine deployment.
\set ON_ERROR_STOP on
-- psql resolves \ir relative to this file.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
DO $$
DECLARE s jsonb;
BEGIN
  s := public.migration_no_contact_status();
  IF s->>'target_project_ref' IS DISTINCT FROM 'kwfqjnepesiihjkdnxou'
    OR (s->>'database_locked')::boolean IS DISTINCT FROM true
    OR coalesce((s->>'active_cron_jobs')::int, -1) <> 0
    OR coalesce((s->>'active_http_triggers')::int, -1) <> 0
    OR coalesce((s->>'queued_http_requests')::int, -1) <> 0
    OR coalesce((s->>'unguarded_network_routines')::int, -1) <> 0
    OR coalesce((s->>'changed_quarantined_routines')::int, -1) <> 0 THEN
    RAISE EXCEPTION 'Not the locked Weborik migration destination. Nothing applied.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
    AND proname LIKE '%\_\_ungated') THEN
    RAISE EXCEPTION 'An older privacy draft is installed. Review that state before applying this release.';
  END IF;
END $$;
\ir ../../supabase/migrations/20261110120000_privacy_lockdown.sql
DO $$
DECLARE s jsonb;
BEGIN
  s := public.migration_no_contact_status();
  IF (s->>'database_locked')::boolean IS DISTINCT FROM true
    OR coalesce((s->>'changed_quarantined_routines')::int, -1) <> 0 THEN
    RAISE EXCEPTION 'Outbound guard verification failed. Rolling privacy changes back.';
  END IF;
END $$;
COMMIT;
\echo PRIVACY_DATABASE_APPLIED_DELIVERY_STILL_LOCKED
