-- Disposable-database fixture for the Hot Sheet matcher/dispatcher behavioural
-- tests. Creates only the objects the migration touches. NOTHING here talks to
-- the network: net.http_post is a stub that records calls into a table.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE SCHEMA net;
CREATE SCHEMA vault;
CREATE SCHEMA cron;

-- Recorded dispatches stand in for real HTTP requests.
CREATE TABLE net.sent_requests (
  id bigserial PRIMARY KEY,
  url text,
  headers jsonb,
  body jsonb
);

CREATE FUNCTION net.http_post(url text, headers jsonb DEFAULT '{}', body jsonb DEFAULT '{}')
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO net.sent_requests(url, headers, body) VALUES (url, headers, body) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE TABLE vault.decrypted_secrets (name text PRIMARY KEY, decrypted_secret text);
INSERT INTO vault.decrypted_secrets VALUES ('email_dispatch_service_role_key', 'test-service-role-key');

CREATE TABLE cron.job (
  jobid bigserial PRIMARY KEY,
  jobname text,
  schedule text,
  command text,
  active boolean DEFAULT true
);
INSERT INTO cron.job (jobname, schedule, command, active) VALUES
  ('process-email-queue-every-minute', '* * * * *', 'SELECT net.http_post(''legacy-anon'');', false),
  ('send-new-match-notification-every-15-min', '*/15 * * * *', 'SELECT net.http_post(''legacy-anon'');', false);

CREATE FUNCTION cron.alter_job(job_id bigint, command text)
RETURNS void LANGUAGE sql AS $$
  UPDATE cron.job SET command = alter_job.command WHERE jobid = alter_job.job_id;
$$;

CREATE TABLE public.counties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  state text
);

CREATE TABLE public.hot_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  criteria jsonb,
  is_active boolean DEFAULT true
);

CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text,
  state text,
  county text,
  city text,
  neighborhood text,
  property_type text,
  price numeric,
  bedrooms int,
  bathrooms numeric,
  lot_size numeric,
  square_feet int,
  parking_spaces numeric,
  garage_spaces int,
  total_parking_spaces int,
  agent_id uuid,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.hot_sheet_sent_listings (
  id bigserial PRIMARY KEY,
  hot_sheet_id uuid,
  listing_id uuid,
  status_at_send text
);
