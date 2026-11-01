-- Minimal fake schema for a throwaway local Postgres. FAKE DATA ONLY.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('test.uid', true),'')::uuid $$;
CREATE TYPE public.app_role AS ENUM ('buyer','agent','admin','developer');
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
CREATE FUNCTION public.has_role(u uuid, r public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role=r) $$;
CREATE TABLE public.delegates(owner uuid, delegate uuid);
CREATE FUNCTION public.can_act_for_agent(o uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM public.delegates WHERE owner=o AND delegate=auth.uid()) $$;
CREATE TABLE public.agent_profiles(id uuid PRIMARY KEY, email text, first_name text);
CREATE TABLE public.listings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid,
  address text, city text, state text, zip_code text, price numeric, status text, description text,
  photos jsonb DEFAULT '[]', commission_rate numeric, commission_type text, disclosures jsonb,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.listing_status_history(listing_id uuid, changed_at timestamptz);
CREATE TABLE public.listing_reminder_log(listing_id uuid PRIMARY KEY, last_sent_at timestamptz,
  kind text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.email_unsubscribes(email_lower text, email text, category text,
  unsubscribed_at timestamptz DEFAULT now(), source text);
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT SELECT, UPDATE ON public.listings TO authenticated;

-- Fake agents: A (owner), B (other agent), D (A's delegate), S (staff admin), U (unsubscribed)
INSERT INTO public.agent_profiles VALUES
 ('00000000-0000-0000-0000-00000000000a','a@test.invalid','Ann'),
 ('00000000-0000-0000-0000-00000000000b','b@test.invalid','Ben'),
 ('00000000-0000-0000-0000-0000000000cc','u@test.invalid','Una');
INSERT INTO public.user_roles VALUES ('00000000-0000-0000-0000-0000000000ff','admin');
INSERT INTO public.delegates VALUES ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000d');
INSERT INTO public.email_unsubscribes(email_lower,email,category) VALUES ('u@test.invalid','u@test.invalid','all');
INSERT INTO public.listings(id,agent_id,address,price,status,created_at) VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','1 Old St',500000,'active',now()-interval '60 days'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','2 New St',600000,'active',now()-interval '5 days'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000cc','3 Unsub St',700000,'active',now()-interval '60 days'),
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000000b','4 Ben St',800000,'off_market',now()-interval '90 days'),
 ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000000b','5 Draft St',1,'draft',now()-interval '90 days');
