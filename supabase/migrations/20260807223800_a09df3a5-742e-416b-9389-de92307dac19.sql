do $$
declare
  v_key text;
  v_req bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'email_dispatch_service_role_key';

  if v_key is null then
    raise exception 'service role key secret missing';
  end if;

  select net.http_post(
    url := 'https://qocduqtfbsevnhlgsfka.supabase.co/functions/v1/admin-update-user-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'user_id', '45f8c741-2cc6-4c43-b901-b869fa7f9d12',
      'new_email', 'yanis@conceptre.com'
    )
  ) into v_req;

  raise notice 'request %', v_req;
end $$;