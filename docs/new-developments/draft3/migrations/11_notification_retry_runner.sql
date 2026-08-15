-- ============================================================
-- New Developments MVP — 11: notification retry dispatcher
-- DRAFT 3 — NOT APPLIED.
--
-- Review item 3: retryPendingSubmissions() gets a real production caller.
-- This is the Postgres side: a Vault-keyed service-role dispatcher that posts
-- to the internal development-notification-retry Edge Function. It mirrors the
-- existing public.invoke_process_email_queue() pattern exactly.
--
-- Applying this migration alone changes NO outbound behaviour:
--   * the dispatcher skips with a WARNING when the Vault secret is missing;
--   * the cron job is intentionally NOT created here (rollout step, post-canary).
-- ============================================================

create or replace function public.invoke_development_notification_retry()
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_key        text;
  request_id   bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
begin
  select ds.decrypted_secret into v_key
  from vault.decrypted_secrets ds
  where ds.name = 'email_dispatch_service_role_key'
  limit 1;

  if v_key is null or length(trim(v_key)) = 0 then
    raise warning 'invoke_development_notification_retry: vault secret missing/empty; skipping';
    return;
  end if;

  select net.http_post(
    url := supabase_url || '/functions/v1/development-notification-retry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key
    ),
    body := '{}'::jsonb
  ) into request_id;
end;
$fn$;

revoke all on function public.invoke_development_notification_retry() from public, anon, authenticated;
grant execute on function public.invoke_development_notification_retry() to service_role;

-- ROLLOUT ONLY (not part of this migration, run after the canary is approved):
--   select cron.schedule(
--     'development-notification-retry-every-10-min',
--     '*/10 * * * *',
--     $$select public.invoke_development_notification_retry();$$
--   );

-- === ROLLBACK ===
-- select cron.unschedule('development-notification-retry-every-10-min');  -- if scheduled
-- drop function public.invoke_development_notification_retry();
