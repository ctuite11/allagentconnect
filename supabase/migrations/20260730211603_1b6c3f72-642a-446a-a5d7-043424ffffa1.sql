-- 1. Provenance columns on listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS creation_source text,
  ADD COLUMN IF NOT EXISTS created_via_function text,
  ADD COLUMN IF NOT EXISTS creation_request_id text;

-- 2. Append-only audit table
CREATE TABLE IF NOT EXISTS public.listing_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid,
  listing_agent_id uuid,
  acting_user_id uuid,
  event_type text NOT NULL,
  creation_source text,
  created_via_function text,
  request_id text,
  db_role text,
  listing_status text,
  address text,
  listing_number text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.listing_audit_events TO authenticated;
GRANT ALL ON public.listing_audit_events TO service_role;

ALTER TABLE public.listing_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents read own listing audit events" ON public.listing_audit_events;
CREATE POLICY "Agents read own listing audit events"
ON public.listing_audit_events FOR SELECT TO authenticated
USING (listing_agent_id = auth.uid() OR acting_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS listing_audit_events_listing_idx ON public.listing_audit_events (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS listing_audit_events_agent_idx ON public.listing_audit_events (listing_agent_id, created_at DESC);

-- 3. Helper: current request role
CREATE OR REPLACE FUNCTION public.current_request_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), ''),
    current_user
  );
$$;

-- 4. Eligibility guard + provenance stamping on INSERT
CREATE OR REPLACE FUNCTION public.listings_enforce_eligible_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.current_request_role();
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_eligible boolean := false;
  v_exception text := NULL;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT public.has_role(v_uid, 'admin') INTO v_is_admin;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles r
    JOIN public.agent_settings s ON s.user_id = r.user_id
    WHERE r.user_id = NEW.agent_id
      AND r.role = 'agent'
      AND s.agent_status = 'verified'
      AND s.account_activated_at IS NOT NULL
  ) INTO v_eligible;

  IF NOT v_eligible THEN
    IF v_is_admin THEN
      v_exception := 'admin_override';
    ELSIF v_role IN ('service_role', 'postgres', 'supabase_admin') THEN
      v_exception := 'service_role_override';
    ELSE
      RAISE EXCEPTION 'Listing creation requires a verified and activated agent account'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.created_by_user_id := COALESCE(NEW.created_by_user_id, v_uid);
  NEW.creation_source := COALESCE(NEW.creation_source,
    CASE WHEN v_uid IS NOT NULL THEN 'app' ELSE v_role END);

  INSERT INTO public.listing_audit_events (
    listing_id, listing_agent_id, acting_user_id, event_type,
    creation_source, created_via_function, request_id, db_role,
    listing_status, address, listing_number, details
  ) VALUES (
    NEW.id, NEW.agent_id, v_uid, 'created',
    NEW.creation_source, NEW.created_via_function, NEW.creation_request_id, v_role,
    NEW.status, NEW.address, NEW.listing_number,
    jsonb_build_object('eligible', v_eligible, 'exception', v_exception)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_enforce_eligible_creator ON public.listings;
CREATE TRIGGER listings_enforce_eligible_creator
BEFORE INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.listings_enforce_eligible_creator();

-- 5. Update / delete provenance (never relies solely on auth.uid())
CREATE OR REPLACE FUNCTION public.listings_record_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.current_request_role();
  v_row public.listings;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  INSERT INTO public.listing_audit_events (
    listing_id, listing_agent_id, acting_user_id, event_type,
    creation_source, created_via_function, request_id, db_role,
    listing_status, address, listing_number, details
  ) VALUES (
    v_row.id, v_row.agent_id, auth.uid(), lower(TG_OP),
    v_row.creation_source, v_row.created_via_function, v_row.creation_request_id, v_role,
    v_row.status, v_row.address, v_row.listing_number,
    CASE WHEN TG_OP = 'UPDATE'
      THEN jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
      ELSE jsonb_build_object('created_by_user_id', v_row.created_by_user_id)
    END
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS listings_record_update_audit ON public.listings;
CREATE TRIGGER listings_record_update_audit
AFTER UPDATE OF status, address, price, agent_id ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.listings_record_audit_event();

DROP TRIGGER IF EXISTS listings_record_delete_audit ON public.listings;
CREATE TRIGGER listings_record_delete_audit
BEFORE DELETE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.listings_record_audit_event();