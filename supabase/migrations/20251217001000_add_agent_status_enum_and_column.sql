-- Repair gap for fresh local installs.
-- Production already had public.agent_status + agent_settings.agent_status
-- (Lovable/schema sync), but no earlier migration created them. Without this,
-- supabase start/db reset fails at 20251217003255 (is_verified_agent).
-- Idempotent: safe if the type/column already exist.

DO $$
BEGIN
  CREATE TYPE public.agent_status AS ENUM (
    'unverified',
    'pending',
    'verified',
    'restricted'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS agent_status public.agent_status
    NOT NULL DEFAULT 'unverified'::public.agent_status;

CREATE INDEX IF NOT EXISTS agent_settings_agent_status_idx
  ON public.agent_settings (agent_status);
