-- ============================================================
-- Migration: index the email_jobs payload->>'to' admin lookup
-- ============================================================
-- Purpose:
--   The admin email-history lookup (admin-list-agent-emails) filters
--   email_jobs on the JSON key 'to' and orders by created_at DESC.
--   No index matches that expression today, so the planner does a full
--   sequential scan of email_jobs (11,202 rows / 34 MB) on every call.
--   Measured: 1,540 ms, 10,609 shared buffers, 10,740 rows discarded.
--
--   This adds ONE expression index matching that exact query shape.
--
-- Scope: index only. No table, view, RLS, policy, data, trigger, cron,
--        email, Hot Sheet or Communications Center changes.
--
-- Date: 2026-08-06
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_email_jobs_payload_to_created_at
  ON public.email_jobs ((payload ->> 'to'), created_at DESC);

-- === ROLLBACK NOTES ===
--   DROP INDEX IF EXISTS public.idx_email_jobs_payload_to_created_at;
-- ============================================================
