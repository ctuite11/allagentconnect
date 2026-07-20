-- Comms Center notification timing: durable digest queue + Eastern 6 PM cron.
-- Schedules (notification_preferences.client_needs_schedule):
--   immediate → existing email_jobs path (unchanged at enqueue sites)
--   daily     → comms_digest_items, sent at 18:00 America/New_York
--   weekly    → comms_digest_items, sent Friday 18:00 America/New_York

-- ---------------------------------------------------------------------------
-- 1. Pending digest items (one row per agent × activity)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comms_digest_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  cadence text NOT NULL CHECK (cadence = ANY (ARRAY['daily'::text, 'weekly'::text])),
  source_type text NOT NULL CHECK (source_type = ANY (ARRAY['client_need'::text, 'broadcast'::text])),
  source_id uuid NOT NULL,
  category text NULL,
  title text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  item_html text NOT NULL DEFAULT ''::text,
  action_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  digest_send_id uuid NULL,
  CONSTRAINT comms_digest_items_unique_activity UNIQUE (agent_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_comms_digest_items_pending
  ON public.comms_digest_items (cadence, agent_id, created_at)
  WHERE digest_send_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_comms_digest_items_agent_pending
  ON public.comms_digest_items (agent_id)
  WHERE digest_send_id IS NULL;

COMMENT ON TABLE public.comms_digest_items IS
  'Pending Communications Center digest rows. Mutually exclusive with per-activity email_jobs for daily/weekly agents.';

-- ---------------------------------------------------------------------------
-- 2. Digest send ledger (one row per agent × cadence × period)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comms_digest_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  cadence text NOT NULL CHECK (cadence = ANY (ARRAY['daily'::text, 'weekly'::text])),
  period_key text NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status = ANY (ARRAY['processing'::text, 'sent'::text, 'failed'::text])),
  email_job_id uuid NULL,
  attempts integer NOT NULL DEFAULT 1,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text NULL,
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  CONSTRAINT comms_digest_sends_unique_period UNIQUE (agent_id, cadence, period_key)
);

CREATE INDEX IF NOT EXISTS idx_comms_digest_sends_retry
  ON public.comms_digest_sends (status, updated_at)
  WHERE status = ANY (ARRAY['processing'::text, 'failed'::text]);

COMMENT ON TABLE public.comms_digest_sends IS
  'Idempotent digest send attempts. period_key is Eastern-dated (daily:YYYY-MM-DD or weekly:YYYY-Www).';

ALTER TABLE public.comms_digest_items
  DROP CONSTRAINT IF EXISTS comms_digest_items_digest_send_id_fkey;

ALTER TABLE public.comms_digest_items
  ADD CONSTRAINT comms_digest_items_digest_send_id_fkey
  FOREIGN KEY (digest_send_id) REFERENCES public.comms_digest_sends(id) ON DELETE SET NULL;

ALTER TABLE public.comms_digest_sends
  DROP CONSTRAINT IF EXISTS comms_digest_sends_email_job_id_fkey;

ALTER TABLE public.comms_digest_sends
  ADD CONSTRAINT comms_digest_sends_email_job_id_fkey
  FOREIGN KEY (email_job_id) REFERENCES public.email_jobs(id) ON DELETE SET NULL;

ALTER TABLE public.comms_digest_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comms_digest_sends ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.comms_digest_items TO service_role;
GRANT ALL ON public.comms_digest_sends TO service_role;
GRANT SELECT ON public.comms_digest_items TO authenticated;
GRANT SELECT ON public.comms_digest_sends TO authenticated;

DROP POLICY IF EXISTS "Agents can read their own digest items" ON public.comms_digest_items;
CREATE POLICY "Agents can read their own digest items"
  ON public.comms_digest_items FOR SELECT
  TO authenticated USING (auth.uid() = agent_id);

DROP POLICY IF EXISTS "Agents can read their own digest sends" ON public.comms_digest_sends;
CREATE POLICY "Agents can read their own digest sends"
  ON public.comms_digest_sends FOR SELECT
  TO authenticated USING (auth.uid() = agent_id);

-- ---------------------------------------------------------------------------
-- 3. Cron pump → process-comms-digests edge function (pg_net)
--    Runs every 15 minutes; the edge function decides whether the Eastern
--    6:00 PM (daily) / Friday 6:00 PM (weekly) window is open.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoke_process_comms_digests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key        text := current_setting('supabase.service_role_key', true);
  request_id   bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  IF v_key IS NULL OR length(trim(v_key)) = 0 THEN
    RAISE WARNING 'invoke_process_comms_digests: supabase.service_role_key GUC is empty; skipping';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := supabase_url || '/functions/v1/process-comms-digests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) INTO request_id;

  RAISE LOG 'invoke_process_comms_digests: dispatched request_id %', request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'invoke_process_comms_digests failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_process_comms_digests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_process_comms_digests() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-comms-digests') THEN
    PERFORM cron.unschedule('process-comms-digests');
  END IF;
  PERFORM cron.schedule(
    'process-comms-digests',
    '*/15 * * * *',
    $cron$ SELECT public.invoke_process_comms_digests(); $cron$
  );
END $$;
