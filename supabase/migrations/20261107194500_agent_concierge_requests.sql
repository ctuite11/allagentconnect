-- AAC Concierge request intake for the Facebook-to-website workflow.
-- Additive only. Run in migration staging first; no scheduled jobs and no emails.
-- A listing intake is NOT a published listing and never becomes a network email.
-- This is separate from the disabled listing-reminder concierge update feature.

-- Restrict attached private photo paths to the submitting agent and request ID.
CREATE OR REPLACE FUNCTION public.concierge_photo_paths_valid(
  p_agent_id uuid, p_request_id uuid, p_paths text[]
)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(cardinality(p_paths) <= 10 AND
    (SELECT bool_and(
      path LIKE p_agent_id::text || '/' || p_request_id::text || '/%'
      AND length(path) <= 220
      AND path ~ '\.(jpg|jpeg|png|webp)$'
    ) FROM unnest(p_paths) AS photo(path)), true)
$$;

CREATE TABLE IF NOT EXISTS public.agent_concierge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('listing', 'broadcast')),
  communication_channel text CHECK (
    communication_channel IN ('buyer_need', 'renter_need', 'sales_intel', 'general_discussion')
  ),
  subject text NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 1 AND 160),
  property_address text CHECK (property_address IS NULL OR char_length(property_address) <= 300),
  property_type text CHECK (property_type IN ('single_family', 'condo', 'townhouse', 'multi_family')),
  asking_price numeric CHECK (asking_price IS NULL OR asking_price > 0),
  bedrooms smallint CHECK (bedrooms IS NULL OR bedrooms BETWEEN 0 AND 30),
  bathrooms numeric(4,1) CHECK (bathrooms IS NULL OR bathrooms BETWEEN 0 AND 30),
  square_feet integer CHECK (square_feet IS NULL OR square_feet BETWEEN 1 AND 1000000),
  lot_acres numeric(12,4) CHECK (lot_acres IS NULL OR lot_acres >= 0),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 4000),
  reference_url text CHECK (reference_url IS NULL OR char_length(reference_url) <= 1000),
  photo_paths text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'completed', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT concierge_request_channel_match CHECK (
    (
      request_type = 'listing'
      AND communication_channel IS NULL
      AND property_address IS NOT NULL AND btrim(property_address) <> ''
      AND property_type IS NOT NULL
      AND asking_price IS NOT NULL
      AND bedrooms IS NOT NULL
      AND bathrooms IS NOT NULL
      AND square_feet IS NOT NULL
      AND (property_type <> 'single_family' OR lot_acres IS NOT NULL)
      AND (property_type = 'single_family' OR lot_acres IS NULL)
    )
    OR (
      request_type = 'broadcast'
      AND communication_channel IS NOT NULL
      AND btrim(details) <> ''
      AND property_address IS NULL
      AND property_type IS NULL
      AND asking_price IS NULL
      AND bedrooms IS NULL
      AND bathrooms IS NULL
      AND square_feet IS NULL
      AND lot_acres IS NULL
      AND cardinality(photo_paths) = 0
    )
  ),
  CONSTRAINT concierge_photo_paths_owner CHECK (
    public.concierge_photo_paths_valid(agent_id, id, photo_paths)
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_concierge_requests_status_created
  ON public.agent_concierge_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_concierge_requests_owner_created
  ON public.agent_concierge_requests (agent_id, created_at DESC);

-- Each intake may have only one member-owned admin concierge listing draft.
-- This index is the database-side duplicate protection for rapid/repeated clicks.
CREATE UNIQUE INDEX IF NOT EXISTS idx_concierge_draft_one_per_request
  ON public.listings (creation_request_id)
  WHERE creation_request_id IS NOT NULL
    AND creation_source = 'admin_concierge';

ALTER TABLE public.agent_concierge_requests ENABLE ROW LEVEL SECURITY;

-- Privacy: a verified, activated agent may submit and see ONLY their own requests.
-- Admins can see the queue and update status, but agents cannot publish or send.
CREATE POLICY agent_concierge_requests_select ON public.agent_concierge_requests
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY agent_concierge_requests_insert ON public.agent_concierge_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    AND status = 'new'
    AND cardinality(photo_paths) = 0
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

-- Agents may add photo paths ONLY while their own listing request is new.
-- Column-level GRANT below restricts clients to the photo_paths column.
CREATE POLICY agent_concierge_requests_owner_photos ON public.agent_concierge_requests
  FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() AND request_type = 'listing' AND status = 'new'
    AND public.has_role(auth.uid(), 'agent'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.agent_settings s
                WHERE s.user_id = auth.uid()
                  AND s.agent_status = 'verified'::public.agent_status
                  AND s.account_activated_at IS NOT NULL))
  WITH CHECK (agent_id = auth.uid() AND request_type = 'listing' AND status = 'new');

REVOKE ALL ON public.agent_concierge_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agent_concierge_requests TO authenticated;
GRANT INSERT (
  agent_id, request_type, communication_channel, subject, property_address,
  property_type, asking_price, bedrooms, bathrooms, square_feet, lot_acres,
  details, reference_url
) ON public.agent_concierge_requests TO authenticated;
GRANT UPDATE (status, photo_paths) ON public.agent_concierge_requests TO authenticated;

-- Private intake-photo bucket: DO NOT use public listing-photos bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'concierge-request-photos', 'concierge-request-photos', false, 10485760,
  ARRAY['image/jpeg','image/png','image/webp']::text[]
) ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Files must live under agent UUID / their request UUID / unique photo name.
CREATE POLICY concierge_request_photos_upload_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'concierge-request-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.agent_concierge_requests r
    JOIN public.agent_settings s ON s.user_id = r.agent_id
    WHERE r.id::text = (storage.foldername(name))[2]
      AND r.agent_id = auth.uid()
      AND r.request_type = 'listing'
      AND r.status = 'new'
      AND s.agent_status = 'verified'::public.agent_status
      AND s.account_activated_at IS NOT NULL
  )
);

CREATE POLICY concierge_request_photos_view_authorized
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'concierge-request-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      (storage.foldername(name))[1] = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM public.agent_concierge_requests r
        WHERE r.id::text = (storage.foldername(name))[2]
          AND r.agent_id = auth.uid()
      )
    )
  )
);

CREATE POLICY concierge_request_photos_delete_own
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'concierge-request-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.agent_concierge_requests r
    WHERE r.id::text = (storage.foldername(name))[2]
      AND r.agent_id = auth.uid()
      AND r.request_type = 'listing'
      AND r.status = 'new'
  )
);

-- Fail closed at the DATABASE boundary, not just on the review page.
-- Even an agent navigating directly to Edit Listing cannot publish a Concierge
-- draft while submitted private photos have not been securely transferred.
-- Other listings (including unrelated drafts) incur no request lookup.
CREATE OR REPLACE FUNCTION public.block_concierge_pending_photo_publication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.agent_concierge_requests r
      WHERE r.id::text = OLD.creation_request_id
        AND r.agent_id = OLD.agent_id
        AND r.request_type = 'listing'
        AND cardinality(r.photo_paths) > 0
  ) THEN
    RAISE EXCEPTION 'Concierge listing cannot be published until private photos are securely attached'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.block_concierge_pending_photo_publication()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER block_concierge_pending_photo_publication
BEFORE UPDATE OF status ON public.listings
FOR EACH ROW
WHEN (
  OLD.status = 'draft'
  AND NEW.status <> 'draft'
  AND OLD.creation_source = 'admin_concierge'
  AND OLD.creation_request_id IS NOT NULL
)
EXECUTE FUNCTION public.block_concierge_pending_photo_publication();

-- On submission, queue ONE fixed-recipient, staff-only notification in the
-- SAME transaction as the request INSERT. If queue insertion fails, the request
-- insertion fails, so the UI never claims a successful submission with no notice.
-- The established admin-adhoc template is routed to AAC's transactional stream;
-- payload.html is explicitly supplied and html-escaped. This is NOT a network
-- broadcast. No email is queued on photo upload or staff status changes.

CREATE OR REPLACE FUNCTION public.concierge_notification_escape_html(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT replace(replace(replace(replace(replace(coalesce(p_value, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;')
$$;

REVOKE ALL ON FUNCTION public.concierge_notification_escape_html(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_concierge_staff_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_email text;
  v_kind text;
  v_channel text;
  v_html text;
  v_subject text;
BEGIN
  SELECT nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email
    INTO v_name, v_email
    FROM public.agent_profiles p WHERE p.id = NEW.agent_id;

  v_kind := CASE WHEN NEW.request_type = 'listing' THEN 'Property Listing'
                 ELSE 'Network Broadcast Email' END;
  v_channel := CASE NEW.communication_channel
    WHEN 'buyer_need' THEN 'Buyer Needs'
    WHEN 'renter_need' THEN 'Renter Needs'
    WHEN 'sales_intel' THEN 'Sales Intel'
    WHEN 'general_discussion' THEN 'General Discussion'
    ELSE '' END;

  v_subject := 'New AAC Concierge request: ' || v_kind || ' - ' || left(NEW.subject, 72);
  v_html :=
     '<h2>New AAC Concierge request</h2>'
     || '<p><b>Type:</b> ' || public.concierge_notification_escape_html(v_kind) || '</p>'
     || '<p><b>Agent:</b> ' || public.concierge_notification_escape_html(coalesce(v_name, 'Agent')) || '</p>'
     || '<p><b>Agent email:</b> ' || public.concierge_notification_escape_html(coalesce(v_email, 'Not provided')) || '</p>'
     || CASE WHEN NEW.request_type = 'broadcast'
        THEN '<p><b>Communications channel:</b> '
            || public.concierge_notification_escape_html(v_channel) || '</p>'
        ELSE '<p><b>Property address:</b> '
            || public.concierge_notification_escape_html(NEW.property_address) || '</p>'
            || '<p><b>Property type:</b> '
            || public.concierge_notification_escape_html(replace(coalesce(NEW.property_type, ''), '_', ' ')) || '</p>'
            || '<p><b>Asking price:</b> $'
            || public.concierge_notification_escape_html(coalesce(NEW.asking_price::text, '')) || '</p>'
            || '<p><b>Beds / baths:</b> '
            || public.concierge_notification_escape_html(concat_ws(' / ', NEW.bedrooms::text, NEW.bathrooms::text)) || '</p>'
            || '<p><b>Square feet:</b> '
            || public.concierge_notification_escape_html(coalesce(NEW.square_feet::text, '')) || '</p>'
            || CASE WHEN NEW.property_type = 'single_family'
               THEN '<p><b>Lot acres:</b> '
                    || public.concierge_notification_escape_html(coalesce(NEW.lot_acres::text, '')) || '</p>'
               ELSE '' END
        END
     || '<p><b>Request:</b> ' || public.concierge_notification_escape_html(NEW.subject) || '</p>'
     || CASE WHEN btrim(NEW.details) <> '' THEN
          '<p><b>Notes:</b> ' ||
          replace(public.concierge_notification_escape_html(NEW.details), chr(10), '<br>') || '</p>'
        ELSE '' END
     || '<p><a href="https://allagentconnect.com/admin/concierge-requests">'
     || 'Open the private Concierge Requests admin queue</a></p>'
     || '<p>Property photos, if provided, are available only in the private admin queue.</p>';

  INSERT INTO public.email_jobs (idempotency_key, payload)
  VALUES (
    'concierge-staff-request:' || NEW.id::text,
    jsonb_build_object(
      'provider', 'resend',
      'template', 'admin-adhoc',
      'to', 'chris@allagentconnect.com',
      'subject', v_subject,
      'reply_to', coalesce(nullif(v_email, ''), 'chris@allagentconnect.com'),
      'html', v_html
    )
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_concierge_staff_notification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER agent_concierge_request_queue_staff_notice
  AFTER INSERT ON public.agent_concierge_requests
  FOR EACH ROW EXECUTE FUNCTION public.queue_concierge_staff_notification();

COMMENT ON TABLE public.agent_concierge_requests IS
  'Private agent-to-staff intake; queues one staff notification per request. No automatic network broadcast or listing publication.';
