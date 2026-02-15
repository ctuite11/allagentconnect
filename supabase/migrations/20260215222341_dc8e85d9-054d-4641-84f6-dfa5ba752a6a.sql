
begin;

create or replace function public.on_hot_sheet_comment_inserted()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_origin text := 'https://allagentconnect.lovable.app';

  v_agent_id uuid;
  v_hot_sheet_name text;
  v_listing_address text;

  -- client -> agent
  v_client_name text;
  v_agent_email text;
  v_agent_first text;
  v_last_seen timestamptz;
  v_recent_agent_email_exists boolean;

  -- agent -> clients
  r_client record;
  v_replying_agent_first text;
  v_recent_client_email_exists boolean;

  -- deeplinks
  v_agent_conversation_url text;
  v_client_conversation_url text;

  -- token lookup per client
  v_share_token text;
begin
  ---------------------------------------------------------------------------
  -- Resolve hot sheet owner + name
  ---------------------------------------------------------------------------
  select hs.user_id, hs.name
    into v_agent_id, v_hot_sheet_name
  from public.hot_sheets hs
  where hs.id = new.hot_sheet_id;

  if v_agent_id is null then
    return new;
  end if;

  ---------------------------------------------------------------------------
  -- Listing address (safe fallback)
  ---------------------------------------------------------------------------
  select l.address
    into v_listing_address
  from public.listings l
  where l.id = new.listing_id;

  v_listing_address := coalesce(nullif(v_listing_address, ''), 'a listing');

  ---------------------------------------------------------------------------
  -- Agent deep link
  ---------------------------------------------------------------------------
  v_agent_conversation_url :=
    v_origin || '/hot-sheets/' || new.hot_sheet_id::text || '/review?listing=' || new.listing_id::text;

  ---------------------------------------------------------------------------
  -- BRANCH A: sender_role = 'client'  (keep behavior, add deep link)
  ---------------------------------------------------------------------------
  if new.sender_role = 'client' then

    select nullif(trim(p.first_name || ' ' || p.last_name), '')
      into v_client_name
    from public.profiles p
    where p.id = new.sender_id;

    v_client_name := coalesce(v_client_name, 'A client');

    -- Always create in-app notification for agent
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

    -- If agent is online (last_seen within 5 minutes), skip email
    select s.last_seen_at
      into v_last_seen
    from public.agent_settings s
    where s.user_id = v_agent_id;

    if v_last_seen is not null and v_last_seen > now() - interval '5 minutes' then
      return new;
    end if;

    -- Debounce agent email: 10 minutes per hot_sheet + agent
    select exists (
      select 1
      from public.email_jobs
      where status in ('queued', 'processing', 'sent')
        and created_at > now() - interval '10 minutes'
        and payload->>'template' = 'hot-sheet-comment'
        and payload->'variables'->>'hot_sheet_id' = new.hot_sheet_id::text
        and payload->'variables'->>'agent_id' = v_agent_id::text
    )
    into v_recent_agent_email_exists;

    if v_recent_agent_email_exists then
      return new;
    end if;

    -- Agent email + first name
    select ap.email, ap.first_name
      into v_agent_email, v_agent_first
    from public.agent_profiles ap
    where ap.id = v_agent_id;

    if v_agent_email is null or v_agent_email = '' then
      return new;
    end if;

    v_agent_first := coalesce(nullif(v_agent_first, ''), 'Agent');

    -- Enqueue agent email (with deep link)
    insert into public.email_jobs (payload)
    values (jsonb_build_object(
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
        'conversationUrl', v_agent_conversation_url,
        'hot_sheet_id', new.hot_sheet_id::text,
        'agent_id', v_agent_id::text,
        'listing_id', new.listing_id::text,
        'comment_id', new.id::text
      )
    ));

    return new;
  end if;

  ---------------------------------------------------------------------------
  -- BRANCH B: sender_role = 'agent'  (notify ALL clients with their OWN token)
  ---------------------------------------------------------------------------
  if new.sender_role = 'agent' then

    select ap.first_name
      into v_replying_agent_first
    from public.agent_profiles ap
    where ap.id = new.sender_id;

    v_replying_agent_first := coalesce(nullif(v_replying_agent_first, ''), 'Your agent');

    for r_client in
      select c.id as client_id,
             c.email as client_email,
             c.first_name as client_first_name
      from public.hot_sheet_clients hsc
      join public.clients c on c.id = hsc.client_id
      where hsc.hot_sheet_id = new.hot_sheet_id
        and c.email is not null
        and c.email <> ''
    loop
      -- Find the token for THIS client + THIS hot sheet
      v_share_token := null;

      select st.token
        into v_share_token
      from public.share_tokens st
      where (st.payload->>'type') = 'client_hotsheet_invite'
        and (st.payload->>'hot_sheet_id') = new.hot_sheet_id::text
        and (
          (st.payload ? 'client_id' and nullif(st.payload->>'client_id','') is not null and st.payload->>'client_id' = r_client.client_id::text)
          or
          ( (not (st.payload ? 'client_id') or nullif(st.payload->>'client_id','') is null)
            and (st.payload ? 'client_email')
            and lower(st.payload->>'client_email') = lower(r_client.client_email)
          )
        )
      order by st.created_at desc
      limit 1;

      -- Safety: no token = no email (no leaking someone else's token)
      if v_share_token is null or v_share_token = '' then
        continue;
      end if;

      v_client_conversation_url :=
        v_origin || '/client/hotsheet/' || v_share_token || '?listing=' || new.listing_id::text;

      -- Debounce per hot_sheet + client + listing for 10 minutes
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
      values (jsonb_build_object(
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
          'conversationUrl', v_client_conversation_url,
          'shareToken', v_share_token,
          'hot_sheet_id', new.hot_sheet_id::text,
          'client_id', r_client.client_id::text,
          'agent_id', new.sender_id::text,
          'listing_id', new.listing_id::text,
          'comment_id', new.id::text
        )
      ));
    end loop;

    return new;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_hot_sheet_comment_inserted on public.hot_sheet_comments;

create trigger trg_hot_sheet_comment_inserted
after insert on public.hot_sheet_comments
for each row
execute function public.on_hot_sheet_comment_inserted();

commit;
