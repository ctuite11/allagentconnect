
create or replace function public.create_buyer_hot_sheet(
  p_name text,
  p_criteria jsonb
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_agent_id uuid;
  v_crm_client_id uuid;
  v_hot_sheet_id uuid;
begin
  if v_buyer_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Resolve active agent
  select agent_id into v_agent_id
  from client_agent_relationships
  where client_id = v_buyer_id and status = 'active'
  limit 1;

  if v_agent_id is null then
    raise exception 'No active agent relationship';
  end if;

  -- Resolve CRM client ID via email bridge
  select c.id into v_crm_client_id
  from clients c
  join profiles p on lower(c.email) = lower(p.email)
  where p.id = v_buyer_id and c.agent_id = v_agent_id
  limit 1;

  if v_crm_client_id is null then
    raise exception 'No CRM client record found for this buyer-agent pair';
  end if;

  -- Insert hot sheet (agent-owned)
  insert into hot_sheets (user_id, client_id, name, criteria, is_active,
                          notify_client_email, notify_agent_email, notification_schedule)
  values (v_agent_id, v_crm_client_id, p_name, p_criteria, true,
          true, true, 'immediately')
  returning id into v_hot_sheet_id;

  -- Link buyer via junction table
  insert into hot_sheet_clients (hot_sheet_id, client_id)
  values (v_hot_sheet_id, v_crm_client_id);

  return v_hot_sheet_id;
end;
$$;
