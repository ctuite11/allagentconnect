-- Disposable-cluster fixture for the Comms Center broadcast attachment RLS
-- tests. Recreates only the objects the attachment migration touches.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE public.comms_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Canonical eligibility helpers, stubbed to a table the tests can control.
CREATE TABLE public.test_eligible_agents (user_id uuid PRIMARY KEY);
CREATE TABLE public.test_admins (user_id uuid PRIMARY KEY);

CREATE FUNCTION public.current_is_eligible_agent() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.test_eligible_agents WHERE user_id = auth.uid());
$$;

CREATE TYPE public.app_role AS ENUM ('buyer','agent','admin','developer');

CREATE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _role = 'admin'::app_role
     AND EXISTS (SELECT 1 FROM public.test_admins WHERE user_id = _user_id);
$$;
