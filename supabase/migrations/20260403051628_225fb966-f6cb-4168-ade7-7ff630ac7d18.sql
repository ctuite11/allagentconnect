-- Migration 1: Critical — Remove duplicate trigger and duplicate RLS policies

-- 1. Drop the redundant trigger on seller_match_outcomes
-- Both 'set_seller_match_latest_outcome' and 'trg_seller_match_outcomes_latest' call the same function.
-- Keep the newer/better-named one, drop the older duplicate.
DROP TRIGGER IF EXISTS set_seller_match_latest_outcome ON public.seller_match_outcomes;

-- 2. Drop 3 duplicate RLS policies on agent_settings
-- These duplicate the existing 'Users can insert/read/update own settings' policies.
DROP POLICY IF EXISTS "settings_insert_own" ON public.agent_settings;
DROP POLICY IF EXISTS "settings_read_own" ON public.agent_settings;
DROP POLICY IF EXISTS "settings_update_own" ON public.agent_settings;