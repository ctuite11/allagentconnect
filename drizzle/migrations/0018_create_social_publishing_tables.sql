-- Social publishing backend (Option 1, backend-only). Three tables, GRANTs, RLS.
-- No FK to auth.users; agents read only their own rows; writes via service role.

CREATE TABLE IF NOT EXISTS public.agent_social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  bundle_team_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_social_accounts_agent_id_key ON public.agent_social_accounts (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS agent_social_accounts_bundle_team_id_key ON public.agent_social_accounts (bundle_team_id);

GRANT SELECT ON public.agent_social_accounts TO authenticated;
GRANT ALL ON public.agent_social_accounts TO service_role;

ALTER TABLE public.agent_social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read own social account"
  ON public.agent_social_accounts FOR SELECT TO authenticated
  USING (agent_id = auth.uid());
CREATE POLICY "Admins read all social accounts"
  ON public.agent_social_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.listing_social_defaults (
  listing_id uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  facebook boolean NOT NULL DEFAULT false,
  instagram boolean NOT NULL DEFAULT false,
  linkedin boolean NOT NULL DEFAULT false,
  threads boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.listing_social_defaults TO authenticated;
GRANT ALL ON public.listing_social_defaults TO service_role;

ALTER TABLE public.listing_social_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read own listing social defaults"
  ON public.listing_social_defaults FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_id AND l.agent_id = auth.uid()
  ));
CREATE POLICY "Admins read all listing social defaults"
  ON public.listing_social_defaults FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.listing_social_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  event_type text NOT NULL,
  platforms text[] NOT NULL,
  caption text,
  image_url text,
  bundle_upload_id text,
  bundle_post_id text,
  reference_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','published','failed','skipped')),
  failure_detail text,
  client_request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS listing_social_events_reference_key_key ON public.listing_social_events (reference_key);
CREATE UNIQUE INDEX IF NOT EXISTS listing_social_events_listing_client_request_key ON public.listing_social_events (listing_id, client_request_id);
CREATE INDEX IF NOT EXISTS listing_social_events_agent_id_idx ON public.listing_social_events (agent_id);

GRANT SELECT ON public.listing_social_events TO authenticated;
GRANT ALL ON public.listing_social_events TO service_role;

ALTER TABLE public.listing_social_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read own listing social events"
  ON public.listing_social_events FOR SELECT TO authenticated
  USING (agent_id = auth.uid());
CREATE POLICY "Admins read all listing social events"
  ON public.listing_social_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Rollback: DROP TABLE public.listing_social_events, public.listing_social_defaults, public.agent_social_accounts;