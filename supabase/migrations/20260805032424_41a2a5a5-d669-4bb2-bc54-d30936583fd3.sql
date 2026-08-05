-- Source of truth: supabase/migrations/20260805030000_retire_legacy_client_need_trigger.sql
-- Retire the legacy automatic Buyer Need email path.
-- Removes ONLY the trigger. The client_needs table, all of its rows, and the
-- function object are preserved (function body neutralised).

DROP TRIGGER IF EXISTS on_client_need_created ON public.client_needs;

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