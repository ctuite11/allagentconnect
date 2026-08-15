-- ============================================================
-- New Developments MVP — 03: inventory (phases, floor plans, units)
-- DRAFT 3 — NOT APPLIED.
-- ============================================================

-- Shared child-table system-column guard (review item 7):
-- timestamps are server-stamped, development_id/account_id are immutable after insert.
create or replace function public.stamp_development_child_common()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
  else
    if new.development_id is distinct from old.development_id
       or new.account_id is distinct from old.account_id then
      raise exception 'development_id and account_id are immutable; a row cannot be moved between projects';
    end if;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;
revoke all on function public.stamp_development_child_common() from public, anon, authenticated;

-- Same, for child tables that also carry created_by / updated_by.
create or replace function public.stamp_development_child_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  else
    if new.development_id is distinct from old.development_id
       or new.account_id is distinct from old.account_id then
      raise exception 'development_id and account_id are immutable; a row cannot be moved between projects';
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), old.updated_by);
  end if;
  return new;
end $$;
revoke all on function public.stamp_development_child_audit() from public, anon, authenticated;

-- ---------- Buildings / phases ----------
create table public.development_buildings_phases (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null,
  account_id uuid not null,
  name text not null,
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, development_id),
  unique (development_id, name)
);
alter table public.development_buildings_phases
  add constraint development_phases_development_fk
  foreign key (development_id, account_id)
  references public.developments(id, account_id) on update cascade on delete cascade;
create unique index uq_development_default_phase
  on public.development_buildings_phases(development_id) where is_default;

grant select on public.development_buildings_phases to authenticated;
grant insert (development_id, account_id, name, sort_order) on public.development_buildings_phases to authenticated;
grant update (name, sort_order) on public.development_buildings_phases to authenticated;
grant delete on public.development_buildings_phases to authenticated;
grant all on public.development_buildings_phases to service_role;
alter table public.development_buildings_phases enable row level security;

create trigger trg_development_phases_stamp
before insert or update on public.development_buildings_phases
for each row execute function public.stamp_development_child_common();

-- ---------- Floor plans ----------
create table public.development_floor_plans (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null,
  account_id uuid not null,
  name text not null,
  description text,
  beds numeric(4,1),
  baths numeric(4,1),
  sqft_min int,
  sqft_max int,
  price_min numeric(12,2),
  price_max numeric(12,2),
  features jsonb not null default '[]',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, development_id),
  unique (development_id, name),
  check (sqft_min is null or sqft_max is null or sqft_min <= sqft_max),
  check (price_min is null or price_max is null or price_min <= price_max)
);
alter table public.development_floor_plans
  add constraint development_floor_plans_development_fk
  foreign key (development_id, account_id)
  references public.developments(id, account_id) on update cascade on delete cascade;

grant select on public.development_floor_plans to authenticated;
grant insert (development_id, account_id, name, description, beds, baths, sqft_min, sqft_max,
              price_min, price_max, features, is_active, sort_order)
  on public.development_floor_plans to authenticated;
grant update (name, description, beds, baths, sqft_min, sqft_max, price_min, price_max,
              features, is_active, sort_order)
  on public.development_floor_plans to authenticated;
grant delete on public.development_floor_plans to authenticated;
grant all on public.development_floor_plans to service_role;
alter table public.development_floor_plans enable row level security;

create trigger trg_development_floor_plans_stamp
before insert or update on public.development_floor_plans
for each row execute function public.stamp_development_child_common();

-- ---------- Units ----------
create table public.development_units (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null,
  account_id uuid not null,
  building_phase_id uuid not null,
  floor_plan_id uuid,
  unit_number text not null,
  floor text,
  beds numeric(4,1),
  baths numeric(4,1),
  sqft int,
  price numeric(12,2) check (price is null or price >= 0),
  status text not null default 'coming_soon'
    check (status in ('available','reserved','under_agreement','sold','coming_soon')),
  description text,
  views_exposure text,
  parking_spaces int,
  parking_notes text,
  outdoor_space text,
  incentives text,
  estimated_delivery date,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  status_changed_at timestamptz,
  price_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, development_id),
  unique (development_id, building_phase_id, unit_number)
);
alter table public.development_units
  add constraint development_units_development_fk
  foreign key (development_id, account_id)
  references public.developments(id, account_id) on update cascade on delete cascade;
alter table public.development_units
  add constraint development_units_phase_fk
  foreign key (building_phase_id, development_id)
  references public.development_buildings_phases(id, development_id) on delete restrict;
alter table public.development_units
  add constraint development_units_floor_plan_fk
  foreign key (floor_plan_id, development_id)
  references public.development_floor_plans(id, development_id) on delete set null;
create index idx_development_units_development on public.development_units(development_id);

grant select on public.development_units to authenticated;
grant insert (development_id, account_id, building_phase_id, floor_plan_id, unit_number, floor,
              beds, baths, sqft, price, status, description, views_exposure, parking_spaces,
              parking_notes, outdoor_space, incentives, estimated_delivery, is_featured, sort_order)
  on public.development_units to authenticated;
grant update (building_phase_id, floor_plan_id, unit_number, floor, beds, baths, sqft, price,
              status, description, views_exposure, parking_spaces, parking_notes, outdoor_space,
              incentives, estimated_delivery, is_featured, sort_order)
  on public.development_units to authenticated;   -- status_changed_at/price_changed_at excluded
grant delete on public.development_units to authenticated;
grant all on public.development_units to service_role;
alter table public.development_units enable row level security;

create or replace function public.stamp_development_unit_changes()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.status_changed_at := now();
    new.price_changed_at := case when new.price is not null then now() else null end;
  else
    if new.development_id is distinct from old.development_id
       or new.account_id is distinct from old.account_id then
      raise exception 'development_id and account_id are immutable; a unit cannot be moved between projects';
    end if;
    new.created_at := old.created_at;
    new.updated_at := now();
    new.status_changed_at := case when new.status is distinct from old.status
                                  then now() else old.status_changed_at end;
    new.price_changed_at := case when new.price is distinct from old.price
                                 then now() else old.price_changed_at end;
  end if;
  return new;
end $$;
revoke all on function public.stamp_development_unit_changes() from public, anon, authenticated;

create trigger trg_development_unit_stamps
before insert or update on public.development_units
for each row execute function public.stamp_development_unit_changes();

-- ---------- Automatic default phase ----------
create or replace function public.create_default_development_phase()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.development_buildings_phases (development_id, account_id, name, is_default, sort_order)
  values (new.id, new.account_id, 'Main', true, 0)
  on conflict do nothing;
  return new;
end $$;
revoke all on function public.create_default_development_phase() from public, anon, authenticated;

create trigger trg_development_default_phase
after insert on public.developments
for each row execute function public.create_default_development_phase();

-- ---------- Policies (identical shape on all three tables) ----------
create policy "Eligible agents read phases on published developments"
on public.development_buildings_phases for select to authenticated
using (public.can_agent_view_development(development_id));

create policy "Members read their phases"
on public.development_buildings_phases for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

create policy "Owners and editors write phases"
on public.development_buildings_phases for all to authenticated
using ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'));

create policy "Eligible agents read floor plans on published developments"
on public.development_floor_plans for select to authenticated
using (public.can_agent_view_development(development_id));

create policy "Members read their floor plans"
on public.development_floor_plans for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

create policy "Owners and editors write floor plans"
on public.development_floor_plans for all to authenticated
using ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'));

create policy "Eligible agents read units on published developments"
on public.development_units for select to authenticated
using (public.can_agent_view_development(development_id));

create policy "Members read their units"
on public.development_units for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

-- sales members get read only here; their writes go through
-- public.set_development_unit_status_price() in migration 08.
create policy "Owners and editors write units"
on public.development_units for all to authenticated
using ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'));

-- === ROLLBACK ===
-- drop trigger trg_development_default_phase on public.developments;
-- drop trigger trg_development_unit_stamps on public.development_units;
-- drop table public.development_units;
-- drop table public.development_floor_plans;
-- drop table public.development_buildings_phases;
-- drop function public.create_default_development_phase();
-- drop function public.stamp_development_unit_changes();
-- drop function public.stamp_development_child_audit();
-- drop function public.stamp_development_child_common();
