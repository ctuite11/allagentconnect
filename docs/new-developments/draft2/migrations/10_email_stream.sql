-- ============================================================
-- New Developments MVP - 10: development_notifications email stream
-- DRAFT 2 - NOT APPLIED.
-- This is the ONE migration in the set that MODIFIES existing email
-- infrastructure (review item 9). It:
--   1. widens the email_jobs.stream CHECK to include development_notifications
--   2. re-creates email_stream_for_template() preserving every existing
--      mapping verbatim and adding exactly two new templates
-- It does NOT touch email_jobs_enforce_stream(), email_jobs_claim(), any
-- existing row, or any existing template. No backfill, retry, or re-enqueue.
-- ============================================================

ALTER TABLE public.email_jobs DROP CONSTRAINT IF EXISTS email_jobs_stream_check;
ALTER TABLE public.email_jobs ADD CONSTRAINT email_jobs_stream_check
  CHECK (stream IS NULL OR stream IN
    ('hot_sheet','communications','transactional','system','development_notifications'));

-- Template -> stream allowlist. Existing entries are byte-identical to the
-- currently deployed definition (migration 20260811001056); only the two
-- development templates are new. Unknown templates still return NULL (fail closed).
CREATE OR REPLACE FUNCTION public.email_stream_for_template(p_template text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $$
  SELECT CASE p_template
    -- ---- Hot Sheet / listing-update stream (isolated) ----
    WHEN 'new-match-notification' THEN 'hot_sheet'
    WHEN 'hot-sheet-status-change' THEN 'hot_sheet'
    WHEN 'hot-sheet-subscriber-status-change' THEN 'hot_sheet'
    WHEN 'hot-sheet-subscriber-update' THEN 'hot_sheet'
    WHEN 'hot-sheet-alert' THEN 'hot_sheet'
    WHEN 'hot-sheet-preview-blast' THEN 'hot_sheet'
    WHEN 'hot-sheet-preview-blast-test' THEN 'hot_sheet'
    WHEN 'hot-sheet-invite' THEN 'hot_sheet'
    WHEN 'hot-sheet-comment' THEN 'hot_sheet'
    WHEN 'hot-sheet-agent-reply' THEN 'hot_sheet'
    WHEN 'price-change-notification' THEN 'hot_sheet'
    WHEN 'stale-listing-reminder' THEN 'hot_sheet'
    WHEN 'buyer-alert' THEN 'hot_sheet'
    WHEN 'seller-alert' THEN 'hot_sheet'
    WHEN 'reverse-prospecting' THEN 'hot_sheet'

    -- ---- Communications Center stream ----
    WHEN 'client-need-broadcast' THEN 'communications'
    WHEN 'client-need-notification' THEN 'communications'
    WHEN 'comms-digest' THEN 'communications'
    WHEN 'comms-center-guide' THEN 'communications'
    WHEN 'agent-activation-nudge' THEN 'communications'
    WHEN 'bulk-email' THEN 'communications'
    WHEN 'bulk-email-group' THEN 'communications'

    -- ---- Transactional (agent/client initiated + account lifecycle) ----
    WHEN 'agent-profile-contact' THEN 'transactional'
    WHEN 'listing-contact-inquiry' THEN 'transactional'
    WHEN 'agent-client-email' THEN 'transactional'
    WHEN 'client-agent-message' THEN 'transactional'
    WHEN 'new-message-notification' THEN 'transactional'
    WHEN 'showing-request' THEN 'transactional'
    WHEN 'listing-share' THEN 'transactional'
    WHEN 'bulk-listing-share' THEN 'transactional'
    WHEN 'favorites-share' THEN 'transactional'
    WHEN 'buyer-workspace-invite' THEN 'transactional'
    WHEN 'account-delegate-invite' THEN 'transactional'
    WHEN 'team-invite' THEN 'transactional'
    WHEN 'team-request-notification' THEN 'transactional'
    WHEN 'team-decision' THEN 'transactional'
    WHEN 'agent-invite' THEN 'transactional'
    WHEN 'admin-created-invite' THEN 'transactional'
    WHEN 'agent-forward-invite' THEN 'transactional'
    WHEN 'personal-forward-invite' THEN 'transactional'
    WHEN 'founder-invite-1to1' THEN 'transactional'
    WHEN 'welcome-email' THEN 'transactional'
    WHEN 'license-verified' THEN 'transactional'
    WHEN 'agent-login-link' THEN 'transactional'
    WHEN 'agent-approval-accepted' THEN 'transactional'
    WHEN 'agent-account-removed' THEN 'transactional'
    WHEN 'agent-temp-password' THEN 'transactional'

    -- ---- System / admin operational ----
    WHEN 'agent-verification-submitted' THEN 'system'

    -- ---- New Developments notifications (added by this migration) ----
    WHEN 'development-lead-notification' THEN 'development_notifications'
    WHEN 'development-showing-request-notification' THEN 'development_notifications'

    ELSE NULL
  END;
$$;

-- === ROLLBACK (exact restoration of the modified existing infrastructure) ===
-- 1. Cancel/settle any queued development_notifications rows first:
--      SELECT count(*) FROM public.email_jobs
--       WHERE stream = 'development_notifications' AND status = 'queued';
--    (Rows must be resolved before the CHECK can be narrowed again. Do NOT
--     re-enqueue or replay anything; per standing policy any queue action needs
--     explicit approval.)
-- 2. Restore the previous CHECK:
--      ALTER TABLE public.email_jobs DROP CONSTRAINT email_jobs_stream_check;
--      ALTER TABLE public.email_jobs ADD CONSTRAINT email_jobs_stream_check
--        CHECK (stream IS NULL OR stream IN ('hot_sheet','communications','transactional','system'));
-- 3. Restore the prior classifier by re-running, verbatim, the body of
--    supabase/migrations/20260811001056_c9a19180-3e28-4e4c-b857-b0ed3571b7b5.sql
--    (that file is the pre-change source of truth for email_stream_for_template).
-- 4. Revert the shared worker registry:
--    supabase/functions/_shared/emailStreams.ts and
--    supabase/functions/kick-email-queue/index.ts back to their pre-change state
--    (see docs/new-developments/draft2/diffs/).
