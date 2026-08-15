-- ============================================================
-- New Developments MVP — 02: developments core
-- DRAFT 3 — NOT APPLIED.
-- ============================================================

create table public.development_id_registry (
  id uuid primary key,
  created_at timestamptz not null default now()
);
revoke all on public.development_id_registry from anon, authenticated;
grant all on public.development_id_registry to service_role;
alter table public.development_id_registry enable row level security;
-- no policies: service_role / definer functions only

create table public.developments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.development_accounts(id) on delete restrict,
  name text not null,
  slug text unique not null,
  slug_locked_at timestamptz,
  logo_url text,
  lifecycle_status text not null default 'coming_soon'
    check (lifecycle_status in ('coming_soon','pre_construction','under_construction','now_selling','completed')),
  publish_status text not null default 'draft'
    check (publish_status in ('draft','pending_review','published','paused','archived')),
  published_at timestamptz,
  published_by uuid,
  submitted_at timestamptz,
  paused_at timestamptz,
  archived_at timestamptz,

  address text,
  city text,
  state text,
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  neighborhood text,
  neighborhood_description text,

  developer_name text,
  architect_name text,
  interior_designer_name text,
  estimated_completion date,
  delivery_from date,
  delivery_to date,

  total_units int,
  total_buildings int,
  stories int,
  year_built int,
  construction_type text,
  building_details jsonb not null default '{}',
  amenities jsonb not null default '[]',
  parking_description text,
  parking_included boolean,
  pet_policy text,
  hoa_fees text,
  hoa_fee_min numeric(12,2),
  hoa_fee_max numeric(12,2),
  hoa_fee_includes text,

  deposit_structure text,
  incentives text,
  buyer_agent_compensation text,
  buyer_agent_compensation_notes text,

  description text,
  highlights jsonb not null default '[]',
  tier text not null default 'standard' check (tier in ('standard','featured','premium')),
  admin_notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, account_id),
  check (delivery_from is null or delivery_to is null or delivery_from <= delivery_to),
  check (hoa_fee_min is null or hoa_fee_max is null or hoa_fee_min <= hoa_fee_max)
);
create index idx_developments_account on public.developments(account_id);
create index idx_developments_publish on public.developments(publish_status);

-- Column grants: no table-level SELECT/INSERT/UPDATE. admin_notes, publish stamps,
-- slug_locked_at and every audit/system column are excluded from client grants
-- (review item 7: server-stamped, never client-supplied).
grant select (id, account_id, name, slug, slug_locked_at, lifecycle_status, publish_status,
              published_at, published_by, submitted_at, paused_at, archived_at, address, city, state,
              postal_code, latitude, longitude, neighborhood, neighborhood_description, logo_url,
              developer_name, architect_name, interior_designer_name, estimated_completion,
              delivery_from, delivery_to, total_units, total_buildings, stories, year_built,
              construction_type, building_details, amenities, parking_description,
              parking_included, pet_policy, hoa_fees, hoa_fee_min, hoa_fee_max, hoa_fee_includes,
              deposit_structure, incentives, buyer_agent_compensation,
              buyer_agent_compensation_notes, description, highlights, tier,
              created_by, updated_by, created_at, updated_at)
  on public.developments to authenticated;

grant insert (account_id, name, slug, lifecycle_status, publish_status, address, city, state,
              postal_code, latitude, longitude, neighborhood, neighborhood_description, logo_url,
              developer_name, architect_name, interior_designer_name, estimated_completion,
              delivery_from, delivery_to, total_units, total_buildings, stories, year_built,
              construction_type, building_details, amenities, parking_description,
              parking_included, pet_policy, hoa_fees, hoa_fee_min, hoa_fee_max, hoa_fee_includes,
              deposit_structure, incentives, buyer_agent_compensation,
              buyer_agent_compensation_notes, description, highlights, tier)
  on public.developments to authenticated;

grant update (name, slug, lifecycle_status, publish_status, address, city, state, postal_code,
              latitude, longitude, neighborhood, neighborhood_description, logo_url,
              developer_name, architect_name, interior_designer_name, estimated_completion,
              delivery_from, delivery_to, total_units, total_buildings, stories, year_built,
              construction_type, building_details, amenities, parking_description,
              parking_included, pet_policy, hoa_fees, hoa_fee_min, hoa_fee_max, hoa_fee_includes,
              deposit_structure, incentives, buyer_agent_compensation,
              buyer_agent_compensation_notes, description, highlights, tier)
  on public.developments to authenticated;   -- account_id absent: no re-parenting

grant all on public.developments to service_role;
alter table public.developments enable row level security;

-- ---------- Helpers ----------
create or replace function public.development_account_id(_development_id uuid)
returns uuid language sql stable security definer set search_path = public
as $$ select account_id from public.developments where id = _development_id $$;

create or replace function public.is_published_development(_development_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.developments d
                     where d.id = _development_id and d.publish_status = 'published') $$;

create or replace function public.can_agent_view_development(_development_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.developments d
    where d.id = _development_id
      and d.publish_status = 'published'
      and public.is_development_account_active(d.account_id)
  ) and public.current_is_eligible_agent();
$$;

revoke all on function public.development_account_id(uuid) from public, anon;
grant execute on function public.development_account_id(uuid) to authenticated, service_role;
revoke all on function public.is_published_development(uuid) from public, anon;
grant execute on function public.is_published_development(uuid) to authenticated, service_role;
revoke all on function public.can_agent_view_development(uuid) from public, anon;
grant execute on function public.can_agent_view_development(uuid) to authenticated, service_role;

-- ---------- Audit/system stamping (review item 7) ----------
create or replace function public.stamp_development_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    if public.current_request_role() <> 'service_role' then
      new.admin_notes := null;
      new.published_at := null;
      new.published_by := null;
      new.submitted_at := null;
      new.paused_at := null;
      new.archived_at := null;
      new.slug_locked_at := null;
    end if;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), old.updated_by);
    if public.current_request_role() <> 'service_role'
       and not public.has_role(auth.uid(), 'admin')
       and new.admin_notes is distinct from old.admin_notes then
      raise exception 'admin_notes is administered by AAC';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.stamp_development_audit() from public, anon, authenticated;

create trigger trg_developments_audit
before insert or update on public.developments
for each row execute function public.stamp_development_audit();

create or replace function public.enforce_immutable_development_account()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.account_id is distinct from old.account_id then
    raise exception 'developments.account_id is immutable; a development cannot be re-parented';
  end if;
  return new;
end $$;
revoke all on function public.enforce_immutable_development_account() from public, anon, authenticated;

create trigger trg_development_account_immutable
before update on public.developments
for each row execute function public.enforce_immutable_development_account();

-- Permanent ids: register on insert, block hard delete
create or replace function public.register_development_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.development_id_registry (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.register_development_id() from public, anon, authenticated;

create trigger trg_development_register_id
after insert on public.developments
for each row execute function public.register_development_id();

create or replace function public.block_development_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'developments are permanent; archive via publish_status = archived';
end $$;
revoke all on function public.block_development_delete() from public, anon, authenticated;

create trigger trg_developments_permanent
before delete on public.developments
for each row execute function public.block_development_delete();

-- Slug permanence
create or replace function public.enforce_development_slug_lock()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.slug is distinct from old.slug and old.slug_locked_at is not null then
    raise exception 'The slug is locked once a development has been published';
  end if;
  return new;
end $$;
revoke all on function public.enforce_development_slug_lock() from public, anon, authenticated;

create trigger trg_development_slug_lock
before update on public.developments
for each row execute function public.enforce_development_slug_lock();

-- Publish transition matrix + stamps
create or replace function public.enforce_development_publish_matrix()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean := public.has_role(auth.uid(), 'admin')
                        or public.current_request_role() = 'service_role';
  v_from text := old.publish_status;
  v_to   text := new.publish_status;
begin
  if v_from = v_to then
    return new;
  end if;

  if v_is_admin then
    if not (
         (v_from in ('draft','pending_review') and v_to = 'published')
      or (v_from = 'published' and v_to in ('paused','archived'))
      or (v_from = 'paused' and v_to in ('published','archived'))
      or (v_from = 'archived' and v_to in ('draft','published'))
      or (v_from = 'pending_review' and v_to in ('draft','archived'))
    ) then
      raise exception 'Publish transition % -> % is not allowed', v_from, v_to;
    end if;
  else
    if not (
         (v_from = 'draft' and v_to = 'pending_review')
      or (v_from = 'pending_review' and v_to = 'draft')
    ) then
      raise exception 'Publish transition % -> % requires an AAC administrator', v_from, v_to;
    end if;
  end if;

  if v_to = 'pending_review' then
    new.submitted_at := now();
  elsif v_to = 'published' then
    if old.published_at is null then
      new.published_at := now();
      new.published_by := auth.uid();
    else
      new.published_at := old.published_at;
      new.published_by := old.published_by;
    end if;
    if old.slug_locked_at is null then
      new.slug_locked_at := now();
    end if;
  elsif v_to = 'paused' then
    new.paused_at := now();
  elsif v_to = 'archived' then
    new.archived_at := now();
  end if;

  return new;
end $$;
revoke all on function public.enforce_development_publish_matrix() from public, anon, authenticated;

create trigger trg_development_publish_matrix
before update on public.developments
for each row execute function public.enforce_development_publish_matrix();

-- ---------- admin_notes access path (review item 6) ----------
create or replace function public.admin_get_development_admin_notes(_development_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_notes text;
begin
  if not public.has_role(auth.uid(), 'admin')
     and public.current_request_role() <> 'service_role' then
    raise exception 'admin role required';
  end if;
  select admin_notes into v_notes from public.developments where id = _development_id;
  return v_notes;
end $$;
revoke all on function public.admin_get_development_admin_notes(uuid) from public, anon;
grant execute on function public.admin_get_development_admin_notes(uuid) to authenticated, service_role;

create or replace function public.admin_set_development_admin_notes(_development_id uuid, _notes text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin')
     and public.current_request_role() <> 'service_role' then
    raise exception 'admin role required';
  end if;
  update public.developments set admin_notes = _notes where id = _development_id;
  if not found then raise exception 'Development not found'; end if;
  return _notes;
end $$;
revoke all on function public.admin_set_development_admin_notes(uuid, text) from public, anon;
grant execute on function public.admin_set_development_admin_notes(uuid, text) to authenticated, service_role;

-- ---------- Policies ----------
create policy "Eligible agents read published developments"
on public.developments for select to authenticated
using (publish_status = 'published'
       and public.is_development_account_active(account_id)
       and public.current_is_eligible_agent());

create policy "Members read their developments"
on public.developments for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

create policy "Owners and editors create developments"
on public.developments for insert to authenticated
with check ((public.is_development_member(account_id, array['owner','editor'])
             and public.is_development_account_active(account_id))
            or public.has_role(auth.uid(),'admin'));

create policy "Owners and editors update their developments"
on public.developments for update to authenticated
using ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'));

-- No DELETE grant and no DELETE policy (permanence).

-- === ROLLBACK ===
-- drop trigger trg_development_publish_matrix on public.developments;
-- drop trigger trg_development_slug_lock on public.developments;
-- drop trigger trg_developments_permanent on public.developments;
-- drop trigger trg_development_register_id on public.developments;
-- drop trigger trg_development_account_immutable on public.developments;
-- drop trigger trg_developments_audit on public.developments;
-- drop table public.developments;
-- drop table public.development_id_registry;
-- drop function public.admin_set_development_admin_notes(uuid, text);
-- drop function public.admin_get_development_admin_notes(uuid);
-- drop function public.enforce_development_publish_matrix();
-- drop function public.enforce_development_slug_lock();
-- drop function public.block_development_delete();
-- drop function public.register_development_id();
-- drop function public.enforce_immutable_development_account();
-- drop function public.stamp_development_audit();
-- drop function public.can_agent_view_development(uuid);
-- drop function public.is_published_development(uuid);
-- drop function public.development_account_id(uuid);
