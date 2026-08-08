CREATE OR REPLACE FUNCTION public.invoke_agent_activation_nudge_once()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key        text;
  request_id   bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  -- One-time job: always unschedule first so it can never repeat.
  BEGIN
    PERFORM cron.unschedule('agent-activation-nudge-one-time');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'invoke_agent_activation_nudge_once: unschedule failed: %', SQLERRM;
  END;

  SELECT ds.decrypted_secret INTO v_key
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'email_dispatch_service_role_key'
  LIMIT 1;

  IF v_key IS NULL OR length(trim(v_key)) = 0 THEN
    RAISE WARNING 'invoke_agent_activation_nudge_once: vault secret missing; skipping';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-agent-activation-nudge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key
    ),
    body := jsonb_build_object('mode', 'send', 'confirm', 'SEND', 'source', 'pg_cron_one_time')
  ) INTO request_id;

  RAISE LOG 'invoke_agent_activation_nudge_once: dispatched request_id %', request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'invoke_agent_activation_nudge_once failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_agent_activation_nudge_once() FROM PUBLIC, anon, authenticated;