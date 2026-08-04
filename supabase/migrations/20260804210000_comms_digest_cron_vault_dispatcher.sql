-- ============================================================================
-- Communications digest cron: vault-based dispatcher.
--
-- Replaces the prior empty-key-skipping service-role GUC dispatcher with
-- Vault secret `comms_digest_cron_secret`, sent as header
-- `x-comms-digest-cron-secret` to process-comms-digests.
--
-- Operator prerequisite (OUT OF BAND — not performed by this migration):
--   create Vault secret name = 'comms_digest_cron_secret'
--   with the same value as Edge env COMMS_DIGEST_CRON_SECRET.
--
-- This migration:
--   * does NOT create or rotate the vault secret
--   * does NOT set Edge Function env COMMS_DIGEST_CRON_SECRET
--   * does NOT unpause email streams
--   * does NOT process digest items or create email_jobs
--   * keeps the existing pg_cron schedule (*/15 * * * *)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.invoke_process_comms_digests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_secret     text;
  request_id   bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  SELECT ds.decrypted_secret
    INTO v_secret
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'comms_digest_cron_secret'
  LIMIT 1;

  IF v_secret IS NULL OR length(trim(v_secret)) = 0 THEN
    RAISE WARNING
      'invoke_process_comms_digests: vault secret comms_digest_cron_secret missing/empty; skipping';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := supabase_url || '/functions/v1/process-comms-digests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-comms-digest-cron-secret', v_secret
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

-- Preserve the existing schedule; recreate only if missing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-comms-digests') THEN
    PERFORM cron.schedule(
      'process-comms-digests',
      '*/15 * * * *',
      $cron$ SELECT public.invoke_process_comms_digests(); $cron$
    );
  END IF;
END $$;
