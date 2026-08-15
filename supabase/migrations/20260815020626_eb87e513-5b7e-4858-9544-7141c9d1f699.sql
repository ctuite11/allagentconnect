-- ============================================================
-- New Developments MVP — 01: accounts, membership, core helpers
-- SSOT: docs/new-developments/MVP_BACKEND_DESIGN_REVIEW.md (Revision 6, approved)
-- ============================================================

-- ---------- Accounts ----------
create table public.development_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  slug text unique not null,
  billing_email text,
  stripe_customer_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.development_accounts to authenticated;
grant update (name, legal_name, billing_email, slug)
  on public.development_accounts to authenticated;   -- no INSERT, no DELETE, no is_active/stripe_customer_id/timestamps
grant all on public.development_accounts to service_role;

alter table public.development_accounts enable row level security;

-- ---------- Members ----------
create table public.development_account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.development_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('owner','editor','sales','viewer')),
  invited_by uuid,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, user_id)
);
create index idx_dev_members_account_role on public.development_account_members(account_id, role);
create index idx_dev_members_user on public.development_account_members(user_id);

grant select on public.development_account_members to authenticated;
grant insert (account_id, user_id, role, invited_by) on public.development_account_members to authenticated;
grant update (role) on public.development_account_members to authenticated;
grant delete on public.development_account_members to authenticated;
grant all on public.development_account_members to service_role;

alter table public.development_account_members enable row level security;

-- ---------- Shared updated_at stamp (development domain only) ----------
create or replace function public.stamp_development_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;   -- created_at is never client-writable
  elsif tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
  end if;
  return new;
end $$;

create trigger trg_development_accounts_updated_at
before insert or update on public.development_accounts
for each row execute function public.stamp_development_updated_at();

create trigger trg_development_members_updated_at
before insert or update on public.development_account_members
for each row execute function public.stamp_development_updated_at();

-- ---------- Helpers ----------
create or replace function public.is_development_member(_account_id uuid, _roles text[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.development_account_members m
    where m.account_id = _account_id
      and m.user_id = auth.uid()
      and (_roles is null or m.role = any(_roles))
  );
$$;

create or replace function public.is_development_account_active(_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.development_accounts a
                 where a.id = _account_id and a.is_active);
$$;

create or replace function public.is_eligible_agent(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.agent_settings s
    where s.user_id = _user_id
      and s.agent_status = 'verified'::agent_status
      and s.account_activated_at is not null
  );
$$;

create or replace function public.current_is_eligible_agent()
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_eligible_agent(auth.uid()) $$;

-- Execution ACLs (explicit; PUBLIC and anon always revoked)
revoke all on function public.stamp_development_updated_at() from public, anon, authenticated;
revoke all on function public.is_eligible_agent(uuid) from public, anon, authenticated;
grant execute on function public.is_eligible_agent(uuid) to service_role;
revoke all on function public.current_is_eligible_agent() from public, anon;
grant execute on function public.current_is_eligible_agent() to authenticated, service_role;
revoke all on function public.is_development_member(uuid, text[]) from public, anon;
grant execute on function public.is_development_member(uuid, text[]) to authenticated, service_role;
revoke all on function public.is_development_account_active(uuid) from public, anon;
grant execute on function public.is_development_account_active(uuid) to authenticated, service_role;

-- ---------- Invariants ----------
create or replace function public.enforce_immutable_development_membership()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.account_id is distinct from old.account_id
     or new.user_id is distinct from old.user_id then
    raise exception 'development_account_members.account_id and user_id are immutable; delete and re-create the membership';
  end if;
  new.invited_by := old.invited_by;
  new.accepted_at := old.accepted_at;
  return new;
end $$;
revoke all on function public.enforce_immutable_development_membership() from public, anon, authenticated;

create trigger trg_development_membership_immutable
before update on public.development_account_members
for each row execute function public.enforce_immutable_development_membership();

create or replace function public.enforce_last_development_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_account_id uuid := coalesce(old.account_id, new.account_id);
  remaining int;
begin
  if tg_op = 'UPDATE' and not (old.role = 'owner' and new.role <> 'owner') then
    return new;
  end if;
  if tg_op = 'DELETE' and old.role <> 'owner' then
    return old;
  end if;

  perform 1 from public.development_accounts where id = v_account_id for update;

  select count(*) into remaining
  from public.development_account_members m
  where m.account_id = v_account_id and m.role = 'owner' and m.id <> old.id;

  if remaining = 0 then
    raise exception 'A development account must retain at least one owner';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.enforce_last_development_owner() from public, anon, authenticated;

create trigger trg_last_development_owner
before update or delete on public.development_account_members
for each row execute function public.enforce_last_development_owner();

create or replace function public.block_development_account_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'development_accounts rows are permanent; set is_active = false instead';
end $$;
revoke all on function public.block_development_account_delete() from public, anon, authenticated;

create trigger trg_block_development_account_delete
before delete on public.development_accounts
for each row execute function public.block_development_account_delete();

create or replace function public.guard_development_account_system_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.is_active is distinct from old.is_active
      or new.stripe_customer_id is distinct from old.stripe_customer_id)
     and public.current_request_role() <> 'service_role'
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'is_active and stripe_customer_id are administered by AAC';
  end if;
  return new;
end $$;
revoke all on function public.guard_development_account_system_fields() from public, anon, authenticated;

create trigger trg_development_account_system_fields
before update on public.development_accounts
for each row execute function public.guard_development_account_system_fields();

-- ---------- Atomic account creation / admin controls ----------
create or replace function public.create_development_account(
  _name text, _slug text, _owner_user_id uuid,
  _legal_name text default null, _billing_email text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_account_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin role required';
  end if;
  if _owner_user_id is null then
    raise exception 'an initial owner is required';
  end if;

  insert into public.development_accounts (name, legal_name, slug, billing_email)
  values (_name, _legal_name, _slug, _billing_email)
  returning id into v_account_id;

  insert into public.development_account_members (account_id, user_id, role, invited_by, accepted_at)
  values (v_account_id, _owner_user_id, 'owner', auth.uid(), now());

  return v_account_id;
end $$;
revoke all on function public.create_development_account(text, text, uuid, text, text) from public, anon;
grant execute on function public.create_development_account(text, text, uuid, text, text) to authenticated, service_role;

create or replace function public.admin_set_development_account_active(_account_id uuid, _is_active boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin')
     and public.current_request_role() <> 'service_role' then
    raise exception 'admin role required';
  end if;
  update public.development_accounts set is_active = _is_active where id = _account_id;
  if not found then raise exception 'Account not found'; end if;
  return _is_active;
end $$;
revoke all on function public.admin_set_development_account_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_development_account_active(uuid, boolean) to authenticated, service_role;

create or replace function public.admin_replace_development_owner(_account_id uuid, _new_owner_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin')
     and public.current_request_role() <> 'service_role' then
    raise exception 'admin role required';
  end if;

  perform 1 from public.development_accounts where id = _account_id for update;

  insert into public.development_account_members (account_id, user_id, role, invited_by, accepted_at)
  values (_account_id, _new_owner_user_id, 'owner', auth.uid(), now())
  on conflict (account_id, user_id) do update set role = 'owner';

  delete from public.development_account_members
  where account_id = _account_id and role = 'owner' and user_id <> _new_owner_user_id;
end $$;
revoke all on function public.admin_replace_development_owner(uuid, uuid) from public, anon;
grant execute on function public.admin_replace_development_owner(uuid, uuid) to authenticated, service_role;

-- ---------- Policies ----------
create policy "Members read their own account"
on public.development_accounts for select to authenticated
using (public.is_development_member(id) or public.has_role(auth.uid(), 'admin'));

create policy "Owners edit their own organization details"
on public.development_accounts for update to authenticated
using ((public.is_development_member(id, array['owner']) and is_active)
       or public.has_role(auth.uid(), 'admin'))
with check ((public.is_development_member(id, array['owner']) and is_active)
       or public.has_role(auth.uid(), 'admin'));

create policy "Members read their account membership"
on public.development_account_members for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

create policy "Owners manage membership"
on public.development_account_members for all to authenticated
using ((public.is_development_member(account_id, array['owner'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(account_id, array['owner'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'));

-- === ROLLBACK ===
-- drop trigger trg_development_account_system_fields on public.development_accounts;
-- drop trigger trg_block_development_account_delete on public.development_accounts;
-- drop trigger trg_last_development_owner on public.development_account_members;
-- drop trigger trg_development_membership_immutable on public.development_account_members;
-- drop trigger trg_development_members_updated_at on public.development_account_members;
-- drop trigger trg_development_accounts_updated_at on public.development_accounts;
-- drop table public.development_account_members;
-- drop table public.development_accounts;
-- drop function public.admin_replace_development_owner(uuid, uuid);
-- drop function public.admin_set_development_account_active(uuid, boolean);
-- drop function public.create_development_account(text, text, uuid, text, text);
-- drop function public.guard_development_account_system_fields();
-- drop function public.block_development_account_delete();
-- drop function public.enforce_last_development_owner();
-- drop function public.enforce_immutable_development_membership();
-- drop function public.current_is_eligible_agent();
-- drop function public.is_eligible_agent(uuid);
-- drop function public.is_development_account_active(uuid);
-- drop function public.is_development_member(uuid, text[]);
-- drop function public.stamp_development_updated_at();