-- ============================================================
-- Purpose:   Retire the legacy automatic Buyer Need email path.
-- Date:      2026-08-05
-- ============================================================
-- Inserting a row into public.client_needs fired
--   on_client_need_created -> notify_agents_of_client_need()
--     -> edge function notify-agents-client-need
-- which launched a SECOND independent network email campaign on top of the
-- Communications Center broadcast. One Buyer Need action must produce at most
-- one fan-out, and that fan-out must originate from the Communications Center
-- compose flow only.
--
-- This migration removes ONLY the trigger. The client_needs table, all of its
-- rows, and the function body are preserved.
-- ============================================================

DROP TRIGGER IF EXISTS on_client_need_created ON public.client_needs;

-- Neutralise the function body so any re-created trigger, or a direct call,
-- cannot resurrect the fan-out. The function is kept (not dropped) so that
-- dependent objects and migration history remain valid.
CREATE OR REPLACE FUNCTION public.notify_agents_of_client_need()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- RETIRED 2026-08-05: the automatic database-trigger email path is disabled.
  -- Buyer Need fan-out is owned exclusively by the Communications Center
  -- compose flow (send-client-need-notification), which applies the
  -- Communications pause gate and the strict loadCommsOptIn policy.
  RETURN NEW;
END;
$$;

-- === ROLLBACK NOTES ===
-- Restore the previous function body from
--   supabase/migrations/20251108062325_6a016024-469a-4657-a88e-45f7fa5d04c6.sql
-- and re-create:
--   CREATE TRIGGER on_client_need_created AFTER INSERT ON public.client_needs
--     FOR EACH ROW EXECUTE FUNCTION notify_agents_of_client_need();
-- ============================================================
