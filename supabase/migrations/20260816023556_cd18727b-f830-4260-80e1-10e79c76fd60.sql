-- Hot Sheet delivery hardening — Migration A: durable outbox tables (inert)

CREATE TABLE public.hot_sheet_listing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  trigger_op text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  claimed_at timestamptz,
  claimed_by text,
  lease_expires_at timestamptz,
  last_error text,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hot_sheet_listing_events_state_check
    CHECK (state IN ('pending','claimed','processed','paused_held','skipped','failed'))
);

CREATE UNIQUE INDEX hot_sheet_listing_events_dedupe_key
  ON public.hot_sheet_listing_events (dedupe_key);

CREATE INDEX hot_sheet_listing_events_worklist
  ON public.hot_sheet_listing_events (state, next_attempt_at, created_at);

CREATE INDEX hot_sheet_listing_events_listing
  ON public.hot_sheet_listing_events (listing_id, created_at DESC);

GRANT ALL ON public.hot_sheet_listing_events TO service_role;
ALTER TABLE public.hot_sheet_listing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages hot sheet listing events"
  ON public.hot_sheet_listing_events FOR ALL
  USING (public.current_request_role() = 'service_role')
  WITH CHECK (public.current_request_role() = 'service_role');

CREATE TABLE public.hot_sheet_delivery_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  status_at_send text NOT NULL,
  hot_sheet_id uuid NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  audience text NOT NULL,
  recipient_key text NOT NULL,
  event_id uuid NOT NULL REFERENCES public.hot_sheet_listing_events(id) ON DELETE CASCADE,
  state text NOT NULL,
  reason text,
  email_job_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hot_sheet_delivery_claims_audience_check
    CHECK (audience IN ('agent','client','subscriber')),
  CONSTRAINT hot_sheet_delivery_claims_state_check
    CHECK (state IN ('enqueued','paused_held','skipped','failed')),
  CONSTRAINT hot_sheet_delivery_claims_enqueued_requires_job
    CHECK (state <> 'enqueued' OR email_job_id IS NOT NULL)
);

CREATE UNIQUE INDEX hot_sheet_delivery_claims_logical_key
  ON public.hot_sheet_delivery_claims
     (listing_id, status_at_send, hot_sheet_id, audience, recipient_key);

CREATE INDEX hot_sheet_delivery_claims_event
  ON public.hot_sheet_delivery_claims (event_id);

GRANT ALL ON public.hot_sheet_delivery_claims TO service_role;
ALTER TABLE public.hot_sheet_delivery_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages hot sheet delivery claims"
  ON public.hot_sheet_delivery_claims FOR ALL
  USING (public.current_request_role() = 'service_role')
  WITH CHECK (public.current_request_role() = 'service_role');

CREATE TABLE public.hot_sheet_event_stage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.hot_sheet_listing_events(id) ON DELETE CASCADE,
  listing_id uuid,
  stage text NOT NULL,
  outcome text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX hot_sheet_event_stage_log_event
  ON public.hot_sheet_event_stage_log (event_id, created_at DESC);

CREATE INDEX hot_sheet_event_stage_log_created_at
  ON public.hot_sheet_event_stage_log (created_at DESC);

GRANT ALL ON public.hot_sheet_event_stage_log TO service_role;
ALTER TABLE public.hot_sheet_event_stage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages hot sheet stage log"
  ON public.hot_sheet_event_stage_log FOR ALL
  USING (public.current_request_role() = 'service_role')
  WITH CHECK (public.current_request_role() = 'service_role');

CREATE TRIGGER update_hot_sheet_listing_events_updated_at
  BEFORE UPDATE ON public.hot_sheet_listing_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hot_sheet_delivery_claims_updated_at
  BEFORE UPDATE ON public.hot_sheet_delivery_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();