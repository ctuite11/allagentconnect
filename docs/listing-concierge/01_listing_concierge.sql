-- Listing reminders + Concierge update service.
-- STAGED FOR NENAD'S ENVIRONMENT ONLY. Not applied to production. Not in drizzle/migrations.
-- Requires existing: public.listings, public.listing_status_history, public.listing_reminder_log,
-- public.email_unsubscribes, public.agent_profiles, public.has_role(uuid, app_role),
-- public.can_act_for_agent(uuid).

-- 1) Meaningful-change tracking -----------------------------------------------------------
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS agent_last_touched_at timestamptz;
COMMENT ON COLUMN public.listings.agent_last_touched_at IS
  'Last meaningful agent change (price, photos, details, status) or explicit "still accurate" confirmation. NULL = never updated since publish.';

CREATE OR REPLACE FUNCTION public.listings_track_meaningful_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'draft' THEN RETURN NEW; END IF;
  IF NEW.price IS DISTINCT FROM OLD.price
     OR NEW.photos IS DISTINCT FROM OLD.photos
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.address IS DISTINCT FROM OLD.address
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.commission_type IS DISTINCT FROM OLD.commission_type
     OR NEW.disclosures IS DISTINCT FROM OLD.disclosures THEN
    NEW.agent_last_touched_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_listings_track_meaningful_change ON public.listings;
CREATE TRIGGER trg_listings_track_meaningful_change
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.listings_track_meaningful_change();

-- One-time backfill: listings with any status change after publish count as updated.
UPDATE public.listings l SET agent_last_touched_at = h.max_changed
FROM (SELECT listing_id, max(changed_at) max_changed FROM public.listing_status_history GROUP BY 1) h
WHERE h.listing_id = l.id AND l.agent_last_touched_at IS NULL
  AND h.max_changed > l.created_at + interval '1 day';

-- 2) One-click "still accurate" -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_listing_current(p_listing_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agent uuid; v_now timestamptz := now();
BEGIN
  SELECT agent_id INTO v_agent FROM listings WHERE id = p_listing_id AND status <> 'draft';
  IF auth.uid() IS NULL OR v_agent IS NULL OR NOT (v_agent = auth.uid() OR public.can_act_for_agent(v_agent)) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE listings SET agent_last_touched_at = v_now WHERE id = p_listing_id;
  RETURN v_now;
END $$;
REVOKE ALL ON FUNCTION public.confirm_listing_current(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_listing_current(uuid) TO authenticated;

-- 3) Reminder candidates: ONE query, no per-listing lookups -------------------------------
CREATE OR REPLACE FUNCTION public.listing_reminder_candidates(p_limit int DEFAULT 50)
RETURNS TABLE(listing_id uuid, agent_id uuid, email text, first_name text,
              address text, city text, state text, zip_code text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.agent_id, ap.email, ap.first_name, l.address, l.city, l.state, l.zip_code, l.status
  FROM listings l
  JOIN agent_profiles ap ON ap.id = l.agent_id AND ap.email IS NOT NULL
  LEFT JOIN listing_reminder_log r ON r.listing_id = l.id
  WHERE l.status IN ('active','off_market')
    AND l.created_at <= now() - interval '30 days'
    AND l.agent_last_touched_at IS NULL                       -- initial campaign: never updated
    AND (r.last_sent_at IS NULL OR r.last_sent_at <= now() - interval '30 days')
    AND NOT EXISTS (SELECT 1 FROM email_unsubscribes u
                    WHERE u.email_lower = lower(ap.email)
                      AND coalesce(u.category,'all') IN ('all','listing_reminders'))
  ORDER BY l.created_at
  LIMIT greatest(1, least(p_limit, 200))
$$;
REVOKE ALL ON FUNCTION public.listing_reminder_candidates(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listing_reminder_candidates(int) TO service_role;

-- Atomic claim: whoever inserts/advances the log row first sends; everyone else skips.
CREATE OR REPLACE FUNCTION public.claim_listing_reminder(p_listing_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  INSERT INTO listing_reminder_log(listing_id, last_sent_at, kind)
  VALUES (p_listing_id, now(), 'never-updated-v1')
  ON CONFLICT (listing_id) DO UPDATE SET last_sent_at = now(), kind = 'never-updated-v1'
    WHERE listing_reminder_log.last_sent_at <= now() - interval '30 days'
  RETURNING true INTO v_ok;
  RETURN coalesce(v_ok, false);
END $$;
REVOKE ALL ON FUNCTION public.claim_listing_reminder(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_listing_reminder(uuid) TO service_role;

-- 4) Concierge requests -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_concierge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  submitted_by uuid NOT NULL,
  update_type text NOT NULL CHECK (update_type IN
    ('still_active','price_change','under_agreement','sold','withdrawn','temporarily_off_market','other')),
  new_price numeric CHECK (new_price IS NULL OR new_price > 0),
  closing_date date,
  final_sale_price numeric CHECK (final_sale_price IS NULL OR final_sale_price > 0),
  buyer_fee_paid_type text CHECK (buyer_fee_paid_type IN ('percent','amount','none','unknown')),
  buyer_fee_paid_value numeric CHECK (buyer_fee_paid_value IS NULL OR buyer_fee_paid_value >= 0),
  notes text CHECK (char_length(notes) <= 4000),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN
    ('submitted','in_review','proposed','published','declined','cancelled')),
  proposed_changes jsonb,
  proposed_by uuid,
  proposed_at timestamptz,
  approved_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sold_requires_fields CHECK (update_type <> 'sold' OR
    (closing_date IS NOT NULL AND final_sale_price IS NOT NULL AND buyer_fee_paid_type IS NOT NULL)),
  CONSTRAINT fee_value_matches_type CHECK (
    (buyer_fee_paid_type IN ('percent','amount') AND buyer_fee_paid_value IS NOT NULL)
    OR (buyer_fee_paid_type IN ('none','unknown') AND buyer_fee_paid_value IS NULL)
    OR buyer_fee_paid_type IS NULL),
  CONSTRAINT fee_percent_range CHECK (buyer_fee_paid_type <> 'percent' OR buyer_fee_paid_value <= 100)
);
CREATE INDEX IF NOT EXISTS listing_concierge_requests_queue_idx
  ON public.listing_concierge_requests(status, created_at);
CREATE INDEX IF NOT EXISTS listing_concierge_requests_agent_idx
  ON public.listing_concierge_requests(agent_id);

CREATE TABLE IF NOT EXISTS public.listing_concierge_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.listing_concierge_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  event text NOT NULL CHECK (event IN ('submitted','in_review','proposed','published','declined','cancelled')),
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Transaction history for Sold, kept separately from the listing row.
CREATE TABLE IF NOT EXISTS public.listing_sale_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.listing_concierge_requests(id) ON DELETE SET NULL,
  closing_date date NOT NULL,
  final_sale_price numeric NOT NULL CHECK (final_sale_price > 0),
  buyer_fee_paid_type text NOT NULL CHECK (buyer_fee_paid_type IN ('percent','amount','none','unknown')),
  buyer_fee_paid_value numeric,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.listing_sale_records IS
  'Compensation ACTUALLY PAID at closing. Never derived from listings.commission_* (compensation offered).';

GRANT SELECT ON public.listing_concierge_requests, public.listing_concierge_events, public.listing_sale_records TO authenticated;
GRANT ALL ON public.listing_concierge_requests, public.listing_concierge_events, public.listing_sale_records TO service_role;
ALTER TABLE public.listing_concierge_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_concierge_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_sale_records ENABLE ROW LEVEL SECURITY;

-- Reads only; every write goes through the functions below.
CREATE POLICY "Agent or admin reads concierge requests" ON public.listing_concierge_requests
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.can_act_for_agent(agent_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Agent or admin reads concierge events" ON public.listing_concierge_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listing_concierge_requests r WHERE r.id = request_id
         AND (r.agent_id = auth.uid() OR public.can_act_for_agent(r.agent_id) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Agent or admin reads sale records" ON public.listing_sale_records
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id
         AND (l.agent_id = auth.uid() OR public.can_act_for_agent(l.agent_id) OR public.has_role(auth.uid(),'admin'))));

-- 4a) Agent submits ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_concierge_request(
  p_listing_id uuid, p_update_type text, p_new_price numeric DEFAULT NULL,
  p_closing_date date DEFAULT NULL, p_final_sale_price numeric DEFAULT NULL,
  p_fee_type text DEFAULT NULL, p_fee_value numeric DEFAULT NULL,
  p_notes text DEFAULT NULL, p_attachments jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agent uuid; v_id uuid;
BEGIN
  SELECT agent_id INTO v_agent FROM listings WHERE id = p_listing_id AND status <> 'draft';
  IF auth.uid() IS NULL OR v_agent IS NULL OR NOT (v_agent = auth.uid() OR public.can_act_for_agent(v_agent)) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_update_type = 'still_active' THEN
    UPDATE listings SET agent_last_touched_at = now() WHERE id = p_listing_id;
  END IF;
  INSERT INTO listing_concierge_requests(listing_id, agent_id, submitted_by, update_type, new_price,
    closing_date, final_sale_price, buyer_fee_paid_type, buyer_fee_paid_value, notes, attachments,
    status)
  VALUES (p_listing_id, v_agent, auth.uid(), p_update_type, p_new_price, p_closing_date,
    p_final_sale_price, p_fee_type, p_fee_value, nullif(trim(p_notes),''), coalesce(p_attachments,'[]'),
    CASE WHEN p_update_type = 'still_active' THEN 'published' ELSE 'submitted' END)
  RETURNING id INTO v_id;
  INSERT INTO listing_concierge_events(request_id, actor_id, event) VALUES (v_id, auth.uid(),
    CASE WHEN p_update_type = 'still_active' THEN 'published' ELSE 'submitted' END);
  RETURN v_id;
END $$;

-- 4b) Staff prepares a proposal. Never touches the live listing. ------------------------------
CREATE OR REPLACE FUNCTION public.admin_propose_concierge_changes(p_request_id uuid, p_changes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF k NOT IN ('price','status','description') THEN
      RAISE EXCEPTION 'field_not_allowed: %', k;
    END IF;
  END LOOP;
  UPDATE listing_concierge_requests
     SET proposed_changes = p_changes, proposed_by = auth.uid(), proposed_at = now(),
         status = 'proposed', updated_at = now()
   WHERE id = p_request_id AND status IN ('submitted','in_review','proposed');
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_open'; END IF;
  INSERT INTO listing_concierge_events(request_id, actor_id, event, details)
  VALUES (p_request_id, auth.uid(), 'proposed', p_changes);
END $$;

-- 4c) ONLY the listing's agent (or their delegate) publishes. Admin role does NOT suffice. -----
CREATE OR REPLACE FUNCTION public.approve_concierge_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r listing_concierge_requests;
BEGIN
  SELECT * INTO r FROM listing_concierge_requests WHERE id = p_request_id FOR UPDATE;
  IF auth.uid() IS NULL OR r.id IS NULL OR NOT (r.agent_id = auth.uid() OR public.can_act_for_agent(r.agent_id)) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF r.status <> 'proposed' THEN RAISE EXCEPTION 'request_not_proposed'; END IF;
  UPDATE listings SET
    price = coalesce((r.proposed_changes->>'price')::numeric, price),
    status = coalesce(r.proposed_changes->>'status', status),
    description = coalesce(r.proposed_changes->>'description', description),
    agent_last_touched_at = now()
  WHERE id = r.listing_id;
  IF r.update_type = 'sold' THEN
    INSERT INTO listing_sale_records(listing_id, request_id, closing_date, final_sale_price,
      buyer_fee_paid_type, buyer_fee_paid_value, recorded_by)
    VALUES (r.listing_id, r.id, r.closing_date, r.final_sale_price,
      r.buyer_fee_paid_type, r.buyer_fee_paid_value, auth.uid());
  END IF;
  UPDATE listing_concierge_requests SET status = 'published', approved_by = auth.uid(),
    published_at = now(), updated_at = now() WHERE id = r.id;
  INSERT INTO listing_concierge_events(request_id, actor_id, event, details)
  VALUES (r.id, auth.uid(), 'published', r.proposed_changes);
END $$;

REVOKE ALL ON FUNCTION public.submit_concierge_request(uuid,text,numeric,date,numeric,text,numeric,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_propose_concierge_changes(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_concierge_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_concierge_request(uuid,text,numeric,date,numeric,text,numeric,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_propose_concierge_changes(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_concierge_request(uuid) TO authenticated;
