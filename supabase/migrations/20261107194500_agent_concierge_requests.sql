-- AAC Concierge request intake for the Facebook-to-website workflow.
-- Additive only. Run in migration staging first; no scheduled jobs and no emails.
-- This is separate from the disabled listing-reminder concierge update feature.

CREATE TABLE IF NOT EXISTS public.agent_concierge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('listing', 'broadcast')),
  communication_channel text CHECK (
    communication_channel IN ('buyer_need', 'renter_need', 'sales_intel', 'general_discussion')
  ),
  CONSTRAINT concierge_request_channel_match CHECK (
    (request_type = 'listing' AND communication_channel IS NULL)
    OR (request_type = 'broadcast' AND communication_channel IS NOT NULL)
  ),
  subject text NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 1 AND 160),
  property_address text CHECK (property_address IS NULL OR char_length(property_address) <= 300),
  details text NOT NULL CHECK (char_length(btrim(details)) BETWEEN 1 AND 4000),
  reference_url text CHECK (reference_url IS NULL OR char_length(reference_url) <= 1000),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'completed', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_concierge_requests_status_created
  ON public.agent_concierge_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_concierge_requests_owner_created
  ON public.agent_concierge_requests (agent_id, created_at DESC);

ALTER TABLE public.agent_concierge_requests ENABLE ROW LEVEL SECURITY;

-- Privacy: a verified, activated agent may submit and see ONLY their own requests.
-- Admins can see the queue and update status, but agents cannot approve/publish/send.
CREATE POLICY agent_concierge_requests_select ON public.agent_concierge_requests
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY agent_concierge_requests_insert ON public.agent_concierge_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    AND status = 'new'
    AND public.has_role(auth.uid(), 'agent'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.agent_settings s
      WHERE s.user_id = auth.uid()
        AND s.agent_status = 'verified'::public.agent_status
        AND s.account_activated_at IS NOT NULL
    )
  );

CREATE POLICY agent_concierge_requests_admin_update ON public.agent_concierge_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON public.agent_concierge_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agent_concierge_requests TO authenticated;
GRANT INSERT (agent_id, request_type, communication_channel, subject, property_address, details, reference_url)
  ON public.agent_concierge_requests TO authenticated;
GRANT UPDATE (status) ON public.agent_concierge_requests TO authenticated;

-- Requests are never a trigger for broadcasts, publishes, or email sends.
COMMENT ON TABLE public.agent_concierge_requests IS
  'Private member-to-staff concierge intake. Submission creates a request only, never a listing or email job.';
