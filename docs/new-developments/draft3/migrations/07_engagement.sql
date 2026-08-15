-- ============================================================
-- New Developments MVP — 07: engagement (saves, shares, leads, showings)
-- DRAFT 3 — NOT APPLIED.
-- ============================================================

create table public.development_saves (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null references public.developments(id) on delete cascade,
  agent_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (development_id, agent_user_id)
);
grant select, insert, delete on public.development_saves to authenticated;
grant all on public.development_saves to service_role;
alter table public.development_saves enable row level security;

create table public.development_shares (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null references public.developments(id) on delete cascade,
  unit_id uuid,
  agent_user_id uuid not null references auth.users(id) on delete cascade,
  share_type text not null check (share_type in
    ('copy_link','email','facebook','x','linkedin','whatsapp','other')),
  created_at timestamptz not null default now(),
  foreign key (unit_id, development_id)
    references public.development_units(id, development_id) on delete set null
);
create index idx_development_shares_development on public.development_shares(development_id);
grant select (id, development_id, unit_id, agent_user_id, share_type, created_at)
  on public.development_shares to authenticated;
grant insert (development_id, unit_id, agent_user_id, share_type)
  on public.development_shares to authenticated;   -- no UPDATE, no DELETE
grant all on public.development_shares to service_role;
alter table public.development_shares enable row level security;

create table public.development_leads (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null,
  account_id uuid not null,
  unit_id uuid,
  agent_user_id uuid not null references auth.users(id) on delete restrict,
  sender_name text not null,
  sender_email text not null,
  sender_phone text,
  message text,
  source text not null check (source in ('development_page','unit_page','share')),
  status text not null default 'new' check (status in ('new','contacted','closed','spam')),
  assigned_contact_id uuid,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.development_leads
  add constraint development_leads_development_fk
  foreign key (development_id, account_id)
  references public.developments(id, account_id) on update cascade on delete cascade;
alter table public.development_leads
  add constraint development_leads_unit_fk
  foreign key (unit_id, development_id)
  references public.development_units(id, development_id) on delete set null;
alter table public.development_leads
  add constraint development_leads_contact_fk
  foreign key (assigned_contact_id, development_id)
  references public.development_sales_contacts(id, development_id) on delete set null;
create index idx_development_leads_development on public.development_leads(development_id, created_at desc);
create index idx_development_leads_unnotified on public.development_leads(created_at) where notified_at is null;

grant select on public.development_leads to authenticated;              -- no INSERT, no DELETE
grant update (status, assigned_contact_id) on public.development_leads to authenticated;
grant all on public.development_leads to service_role;
alter table public.development_leads enable row level security;

create table public.development_showing_requests (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null,
  account_id uuid not null,
  unit_id uuid,
  agent_user_id uuid not null references auth.users(id) on delete restrict,
  requester_name text not null,
  requester_email text not null,
  requester_phone text,
  preferred_date date,
  preferred_time text,
  message text,
  status text not null default 'pending'
    check (status in ('pending','confirmed','completed','cancelled','declined')),
  assigned_contact_id uuid,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.development_showing_requests
  add constraint development_showings_development_fk
  foreign key (development_id, account_id)
  references public.developments(id, account_id) on update cascade on delete cascade;
alter table public.development_showing_requests
  add constraint development_showings_unit_fk
  foreign key (unit_id, development_id)
  references public.development_units(id, development_id) on delete set null;
alter table public.development_showing_requests
  add constraint development_showings_contact_fk
  foreign key (assigned_contact_id, development_id)
  references public.development_sales_contacts(id, development_id) on delete set null;
create index idx_development_showings_development on public.development_showing_requests(development_id, created_at desc);
create index idx_development_showings_unnotified on public.development_showing_requests(created_at) where notified_at is null;

grant select on public.development_showing_requests to authenticated;   -- no INSERT, no DELETE
grant update (status, assigned_contact_id) on public.development_showing_requests to authenticated;
grant all on public.development_showing_requests to service_role;
alter table public.development_showing_requests enable row level security;

-- ---------- Triage guard: only status / assigned_contact_id may move ----------
create or replace function public.guard_development_submission_triage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.current_request_role() = 'service_role' then
    new.updated_at := now();
    return new;
  end if;

  new.updated_at := now();

  if to_jsonb(new) - 'status' - 'assigned_contact_id' - 'updated_at'
     is distinct from to_jsonb(old) - 'status' - 'assigned_contact_id' - 'updated_at' then
    raise exception 'Only status and assigned_contact_id may be changed';
  end if;

  return new;
end $$;
revoke all on function public.guard_development_submission_triage() from public, anon, authenticated;

create trigger trg_development_leads_triage
before update on public.development_leads
for each row execute function public.guard_development_submission_triage();

create trigger trg_development_showings_triage
before update on public.development_showing_requests
for each row execute function public.guard_development_submission_triage();

-- ---------- Policies ----------
create policy "Agents manage their own development saves"
on public.development_saves for all to authenticated
using (agent_user_id = auth.uid() and public.current_is_eligible_agent())
with check (agent_user_id = auth.uid()
            and public.current_is_eligible_agent()
            and public.can_agent_view_development(development_id));

-- Review item 4 (Draft 3): AAC admins retain row-level visibility for abuse
-- review and analytics. Development members are NOT included here — they stay
-- aggregate-only via public.get_development_engagement_summary().
create policy "AAC admins read development saves"
on public.development_saves for select to authenticated
using (public.has_role(auth.uid(),'admin'));

-- Review item 5: explicit share policies.
create policy "Agents record their own development shares"
on public.development_shares for insert to authenticated
with check (agent_user_id = auth.uid()
            and public.current_is_eligible_agent()
            and public.can_agent_view_development(development_id));

create policy "Agents read only their own development shares"
on public.development_shares for select to authenticated
using (agent_user_id = auth.uid());

create policy "AAC admins read development shares"
on public.development_shares for select to authenticated
using (public.has_role(auth.uid(),'admin'));
-- Developers/admins never read share rows: they use
-- public.get_development_engagement_summary() (migration 08) for counts only.

create policy "Agents read their own leads"
on public.development_leads for select to authenticated
using (agent_user_id = auth.uid() and public.current_is_eligible_agent());

create policy "Members read their account leads"
on public.development_leads for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

create policy "Triage roles update leads"
on public.development_leads for update to authenticated
using ((public.is_development_member(account_id, array['owner','editor','sales'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(account_id, array['owner','editor','sales'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'));

create policy "Agents read their own showing requests"
on public.development_showing_requests for select to authenticated
using (agent_user_id = auth.uid() and public.current_is_eligible_agent());

create policy "Members read their account showing requests"
on public.development_showing_requests for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

create policy "Triage roles update showing requests"
on public.development_showing_requests for update to authenticated
using ((public.is_development_member(account_id, array['owner','editor','sales'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(account_id, array['owner','editor','sales'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'));

-- === ROLLBACK ===
-- drop trigger trg_development_showings_triage on public.development_showing_requests;
-- drop trigger trg_development_leads_triage on public.development_leads;
-- drop table public.development_showing_requests;
-- drop table public.development_leads;
-- drop table public.development_shares;
-- drop table public.development_saves;
-- drop function public.guard_development_submission_triage();
