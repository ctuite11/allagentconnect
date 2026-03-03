
create table if not exists public.client_agent_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  agent_id uuid not null,
  sender_user_id uuid not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now(),
  email_job_id uuid null
);

create index if not exists client_agent_messages_client_id_idx
  on public.client_agent_messages(client_id);

create index if not exists client_agent_messages_agent_id_idx
  on public.client_agent_messages(agent_id);

create index if not exists client_agent_messages_sender_user_id_idx
  on public.client_agent_messages(sender_user_id);

alter table public.client_agent_messages enable row level security;

drop policy if exists "Buyers can message their agent" on public.client_agent_messages;
create policy "Buyers can message their agent"
on public.client_agent_messages
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and exists (
    select 1
    from public.clients c
    join public.profiles p on lower(c.email) = lower(p.email)
    where c.id = client_id
      and p.id = auth.uid()
      and c.agent_id = agent_id
  )
);

drop policy if exists "Buyers can view their sent messages" on public.client_agent_messages;
create policy "Buyers can view their sent messages"
on public.client_agent_messages
for select
to authenticated
using (
  sender_user_id = auth.uid()
  and exists (
    select 1
    from public.clients c
    join public.profiles p on lower(c.email) = lower(p.email)
    where c.id = client_id
      and p.id = auth.uid()
      and c.agent_id = agent_id
  )
);

drop policy if exists "Agents can view messages sent to them" on public.client_agent_messages;
create policy "Agents can view messages sent to them"
on public.client_agent_messages
for select
to authenticated
using (agent_id = auth.uid());
