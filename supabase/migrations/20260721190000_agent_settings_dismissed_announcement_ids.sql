-- Versioned in-app announcement acknowledgements for authenticated agents.
-- Used by one-time popups such as messaging-preferences-fix-2026-07.

ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS dismissed_announcement_ids text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.agent_settings.dismissed_announcement_ids IS
  'Versioned in-app announcement IDs the agent has acknowledged (e.g. messaging-preferences-fix-2026-07).';
