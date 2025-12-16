-- AGENT SETTINGS + ONBOARDING FLAGS
CREATE TABLE IF NOT EXISTS public.agent_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- onboarding flags
  onboarding_started boolean NOT NULL DEFAULT false,
  onboarding_completed boolean NOT NULL DEFAULT false,
  preferences_set boolean NOT NULL DEFAULT false,
  notifications_set boolean NOT NULL DEFAULT false,

  -- preferences
  price_min integer,
  price_max integer,
  price_no_min boolean NOT NULL DEFAULT false,
  price_no_max boolean NOT NULL DEFAULT false,

  property_types text[] NOT NULL DEFAULT '{}',
  state text,
  county text,
  towns text[] NOT NULL DEFAULT '{}',

  -- notifications
  email_frequency text NOT NULL DEFAULT 'immediate',
  notifications_enabled boolean NOT NULL DEFAULT true,
  muted_all boolean NOT NULL DEFAULT false,

  -- ui / tour
  tour_completed boolean NOT NULL DEFAULT false,
  welcome_modal_dismissed boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS agent_settings_onboarding_completed_idx ON public.agent_settings(onboarding_completed);

-- UPDATED_AT trigger
CREATE OR REPLACE FUNCTION public.set_agent_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS agent_settings_set_updated_at ON public.agent_settings;
CREATE TRIGGER agent_settings_set_updated_at
BEFORE UPDATE ON public.agent_settings
FOR EACH ROW EXECUTE FUNCTION public.set_agent_settings_updated_at();

-- RLS
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_read_own" ON public.agent_settings
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "settings_insert_own" ON public.agent_settings
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settings_update_own" ON public.agent_settings
FOR UPDATE USING (auth.uid() = user_id);