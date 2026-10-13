-- Disposable-database fixture for Hot Sheet draft tests. No network, no email
-- provider, no cron: email_jobs and net.sent_requests exist only so the tests
-- can prove nothing was queued or dispatched.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA net;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE TABLE net.sent_requests (id bigserial PRIMARY KEY, url text);
CREATE TABLE public.email_jobs (id bigserial PRIMARY KEY, to_email text);

CREATE TYPE public.property_type AS ENUM ('single_family','condo','townhouse','multi_family','land','commercial','residential_rental','commercial_rental');
CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE TABLE public.agent_profiles (id uuid PRIMARY KEY);
CREATE TABLE public.clients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid, email text);
CREATE TABLE public.client_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submitted_by uuid, property_type public.property_type,
  city text, state text, max_price numeric, bedrooms int, bathrooms numeric, description text);

CREATE TABLE public.hot_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  client_id uuid,
  notify_client_email boolean DEFAULT false,
  notify_agent_email boolean DEFAULT true,
  notification_schedule text DEFAULT 'immediately'
    CHECK (notification_schedule = ANY (ARRAY['immediately','daily','weekly'])),
  last_sent_at timestamptz,
  sheet_type text CHECK (sheet_type IS NULL OR sheet_type = ANY (ARRAY['personal','buyer']))
);
CREATE TABLE public.hot_sheet_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hot_sheet_id uuid NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id));
CREATE TABLE public.hot_sheet_recipient_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hot_sheet_id uuid NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  client_id uuid, listing_ids uuid[]);

-- Production copies (verbatim bodies) of the existing guards and buyer-need sync.
CREATE FUNCTION public.hot_sheet_guard_personal_type() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.sheet_type = 'personal' AND (TG_OP = 'INSERT' OR OLD.sheet_type IS DISTINCT FROM 'personal') THEN
    IF NEW.client_id IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.hot_sheet_clients WHERE hot_sheet_id = NEW.id)
       OR EXISTS (SELECT 1 FROM public.hot_sheet_recipient_batches WHERE hot_sheet_id = NEW.id) THEN
      RAISE EXCEPTION 'Remove contacts and buyer batches before making this a Personal Hot Sheet' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF NEW.sheet_type = 'personal' AND NEW.client_id IS NOT NULL THEN
    RAISE EXCEPTION 'Personal Hot Sheets cannot have a contact' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER hot_sheets_guard_personal_type BEFORE INSERT OR UPDATE OF sheet_type, client_id ON public.hot_sheets
FOR EACH ROW EXECUTE FUNCTION public.hot_sheet_guard_personal_type();

CREATE FUNCTION public.hot_sheet_block_personal_recipients() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.hot_sheets WHERE id = NEW.hot_sheet_id AND sheet_type = 'personal') THEN
    RAISE EXCEPTION 'Personal Hot Sheets cannot have contacts, invitations or buyer batches' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER hot_sheet_clients_block_personal BEFORE INSERT OR UPDATE ON public.hot_sheet_clients FOR EACH ROW EXECUTE FUNCTION public.hot_sheet_block_personal_recipients();
CREATE TRIGGER hot_sheet_recipient_batches_block_personal BEFORE INSERT OR UPDATE ON public.hot_sheet_recipient_batches FOR EACH ROW EXECUTE FUNCTION public.hot_sheet_block_personal_recipients();

CREATE FUNCTION public.sync_hot_sheet_to_client_needs() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE city_val text; state_val text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.user_id) THEN RETURN NEW; END IF;
  city_val := (NEW.criteria->'cities'->>0)::text;
  state_val := (NEW.criteria->>'state')::text;
  IF state_val IS NOT NULL OR city_val IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM client_needs WHERE submitted_by = NEW.user_id AND description LIKE '%hot sheet: ' || NEW.name || '%') THEN
      UPDATE client_needs SET city = city_val, state = state_val WHERE submitted_by = NEW.user_id AND description LIKE '%hot sheet: ' || NEW.name || '%';
    ELSE
      INSERT INTO client_needs (submitted_by, property_type, city, state, description)
      VALUES (NEW.user_id, 'single_family', city_val, state_val, 'Auto-generated from hot sheet: ' || NEW.name);
    END IF;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER sync_hot_sheet_to_client_needs_trigger AFTER INSERT OR UPDATE ON public.hot_sheets FOR EACH ROW EXECUTE FUNCTION public.sync_hot_sheet_to_client_needs();
