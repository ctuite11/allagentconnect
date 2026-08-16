-- Additional disposable-cluster objects required by the durable-outbox tests.
-- Loaded AFTER 00_fixture.sql and BEFORE the outbox migrations.
-- Nothing here talks to the network or to any email provider.

CREATE TABLE public.email_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL,
  stream text,
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_jobs_idempotency_key_uniq
  ON public.email_jobs (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- In the disposable cluster every session is the trusted harness session.
CREATE FUNCTION public.current_request_role() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;

CREATE FUNCTION public.assert_service_role() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF public.current_request_role() <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
END; $$;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
