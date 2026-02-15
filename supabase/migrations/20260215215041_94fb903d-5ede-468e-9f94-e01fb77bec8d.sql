
create or replace function public.on_hot_sheet_comment_inserted()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_agent_id uuid;
  v_hot_sheet_name text;
  v_listing_address text;

  -- client -> agent path
  v_client_name text;
  v_agent_email text;
  v_agent_first text;
  v_last_seen timestamptz;
  v_recent_email_exists boolean;

  -- agent -> clients path
  r_client record;
  v_replying_agent_first text;
  v_recent_client_email_exists boolean;
begin
  select hs.user_id, hs.name
    into v_agent_id, v_hot_sheet_name
  from public.hot_sheets hs
  where hs.id = new.hot_sheet_id;

  if v_agent_id is null then
    return new;
  end if;

  select l.address
    into v_listing_address
  from public.listings l
  where l.id = new.listing_id;

  v_listing_address := coalesce(nullif(v_listing_address, ''), 'a listing');

  -- BRANCH A: sender_role = 'client'
  if new.sender_role = 'client' then

    select nullif(trim(p.first_name || ' ' || p.last_name), '')
      into v_client_name
    from public.profiles p
    where p.id = new.sender_id;

    v_client_name := coalesce(v_client_name, 'A client');

    insert into public.agent_notifications (agent_id, type, title, body, metadata)
    values (
      v_agent_id,
      'hot_sheet_comment',
      'New comment on ' || v_listing_address,
      v_client_name || ' commented: ' || left(coalesce(new.comment, ''), 120),
      jsonb_build_object(
        'hot_sheet_id', new.hot_sheet_id,
        'listing_id', new.listing_id,
        'comment_id', new.id
      )
    );

    select s.last_seen_at
      into v_last_seen
    from public.agent_settings s
    where s.user_id = v_agent_id;

    if v_last_seen is not null and v_last_seen > now() - interval '5 minutes' then
      return new;
    end if;

    select exists (
      select 1
      from public.email_jobs
      where status in ('queued', 'processing', 'sent')
        and created_at > now() - interval '10 minutes'
        and payload->>'template' = 'hot-sheet-comment'
        and payload->'variables'->>'hot_sheet_id' = new.hot_sheet_id::text
        and payload->'variables'->>'agent_id' = v_agent_id::text
    )
    into v_recent_email_exists;

    if v_recent_email_exists then
      return new;
    end if;

    select ap.email, ap.first_name
      into v_agent_email, v_agent_first
    from public.agent_profiles ap
    where ap.id = v_agent_id;

    if v_agent_email is null or v_agent_email = '' then
      return new;
    end if;

    v_agent_first := coalesce(nullif(v_agent_first, ''), 'Agent');

    insert into public.email_jobs (payload)
    values (
      jsonb_build_object(
        'provider', 'resend',
        'template', 'hot-sheet-comment',
        'to', v_agent_email,
        'subject',
          'New comment on your Hot Sheet "' || coalesce(nullif(v_hot_sheet_name, ''), 'Untitled') || '"',
        'variables', jsonb_build_object(
          'agentName', v_agent_first,
          'clientName', v_client_name,
          'hotSheetName', coalesce(nullif(v_hot_sheet_name, ''), 'Untitled'),
          'listingAddress', v_listing_address,
          'commentPreview', left(coalesce(new.comment, ''), 200),
          'hot_sheet_id', new.hot_sheet_id::text,
          'agent_id', v_agent_id::text
        )
      )
    );

    return new;
  end if;

  -- BRANCH B: sender_role = 'agent'
  if new.sender_role = 'agent' then

    select ap.first_name
      into v_replying_agent_first
    from public.agent_profiles ap
    where ap.id = new.sender_id;

    v_replying_agent_first := coalesce(nullif(v_replying_agent_first, ''), 'Your agent');

    for r_client in
      select
        c.id as client_id,
        c.email as client_email,
        c.first_name as client_first_name
      from public.hot_sheet_clients hsc
      join public.clients c on c.id = hsc.client_id
      where hsc.hot_sheet_id = new.hot_sheet_id
        and c.email is not null
        and c.email <> ''
    loop
      select exists (
        select 1
        from public.email_jobs
        where status in ('queued', 'processing', 'sent')
          and created_at > now() - interval '10 minutes'
          and payload->>'template' = 'hot-sheet-agent-reply'
          and payload->'variables'->>'hot_sheet_id' = new.hot_sheet_id::text
          and payload->'variables'->>'client_id' = r_client.client_id::text
          and payload->'variables'->>'listing_id' = new.listing_id::text
      )
      into v_recent_client_email_exists;

      if v_recent_client_email_exists then
        continue;
      end if;

      insert into public.email_jobs (payload)
      values (
        jsonb_build_object(
          'provider', 'resend',
          'template', 'hot-sheet-agent-reply',
          'to', r_client.client_email,
          'subject',
            v_replying_agent_first || ' posted an update in "' || coalesce(nullif(v_hot_sheet_name, ''), 'Untitled') || '"',
          'variables', jsonb_build_object(
            'clientName', coalesce(nullif(r_client.client_first_name, ''), 'there'),
            'agentName', v_replying_agent_first,
            'hotSheetName', coalesce(nullif(v_hot_sheet_name, ''), 'Untitled'),
            'listingAddress', v_listing_address,
            'commentPreview', left(coalesce(new.comment, ''), 200),
            'hot_sheet_id', new.hot_sheet_id::text,
            'client_id', r_client.client_id::text,
            'agent_id', new.sender_id::text,
            'listing_id', new.listing_id::text,
            'comment_id', new.id::text
          )
        )
      );
    end loop;

    return new;
  end if;

  return new;
end;
$function$;

-- Ensure the trigger points at the updated function
drop trigger if exists trg_hot_sheet_comment_inserted on public.hot_sheet_comments;
drop trigger if exists trg_hot_sheet_comment_notify on public.hot_sheet_comments;

create trigger trg_hot_sheet_comment_inserted
after insert on public.hot_sheet_comments
for each row
execute function public.on_hot_sheet_comment_inserted();
