
-- B1: Add idempotency_key to email_jobs
ALTER TABLE public.email_jobs
ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS email_jobs_idempotency_key_unique
ON public.email_jobs (idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- B2: Invite events audit table
CREATE TABLE IF NOT EXISTS public.invite_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  token_id uuid NOT NULL REFERENCES public.share_tokens(id) ON DELETE CASCADE,
  hot_sheet_id uuid NULL,
  client_id uuid NULL,
  client_email text NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'token_created',
    'email_enqueued',
    'email_sent',
    'email_failed',
    'token_accepted',
    'invite_resent'
  )),
  email_job_id uuid NULL REFERENCES public.email_jobs(id) ON DELETE SET NULL,
  actor_user_id uuid NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS invite_events_token_id_idx ON public.invite_events(token_id);
CREATE INDEX IF NOT EXISTS invite_events_hot_sheet_id_idx ON public.invite_events(hot_sheet_id);
CREATE INDEX IF NOT EXISTS invite_events_client_email_idx ON public.invite_events(client_email);
CREATE INDEX IF NOT EXISTS invite_events_created_at_idx ON public.invite_events(created_at);

-- RLS
ALTER TABLE public.invite_events ENABLE ROW LEVEL SECURITY;

-- Admin: full read
CREATE POLICY "Admins can read all invite events"
ON public.invite_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Agent: read only for tokens where share_tokens.agent_id = auth.uid()
CREATE POLICY "Agents can read their own invite events"
ON public.invite_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.share_tokens st
    WHERE st.id = invite_events.token_id
      AND st.agent_id = auth.uid()
  )
);

-- Service role inserts (edge functions)
CREATE POLICY "Service role can insert invite events"
ON public.invite_events FOR INSERT
WITH CHECK (true);
