# New Developments MVP — Backend Implementation Package (Draft 1, for review)

Status: **DRAFT / REVIEW ONLY. NOTHING APPLIED.**
No migration has been run, no bucket created, no RLS or grant changed, no RPC or Edge Function created or deployed, no secret set, no frontend deployed. Every SQL block and function body below is proposed text awaiting approval.

SSOT: `docs/new-developments/MVP_BACKEND_DESIGN_REVIEW.md` (Revision 6, APPROVED).

## 0. Approved guardrails folded into this draft

| # | Guardrail | Where it lands in this package |
|---|---|---|
| G1 | `is_active = false` must also block non-admin writes through `set_development_unit_status_price()` and through Storage; agent Storage reads and agent signed-document downloads require an active account; account members may still read/download their own material for recovery. | §5.2 (RPC active-account check), §4 (storage policies), §6.3 (`development-document-url` Path A adds active-account, Path B unchanged) |
| G2 | Lead/showing rate-limit keys must include both `auth.uid()` **and** `development_id`. | §6.1 key format `route:…\|development:{development_id}\|user:{auth_uid}` |
| G3 | Resolve/validate the authenticated user **before** applying the user-based rate limiter. | §6.1 canonical order: `getUser → validate body → Turnstile → user+development rate limit → eligibility/publish/active → persist → notify` |

Nothing else in Revision 6 is changed by this package.

---

## 1. Migration set (proposed files, not applied)

All files land in `supabase/migrations/` using `YYYYMMDDHHMM_description.sql`. The timestamps below are placeholders assigned at apply time, in the listed order. Every file follows the mandated order: `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY`, and ends with a rollback note.

Order:

```
01  new_developments_01_accounts_members.sql
02  new_developments_02_developments_core.sql
03  new_developments_03_inventory.sql
04  new_developments_04_updates.sql
05  new_developments_05_media_documents.sql
06  new_developments_06_sales_contacts.sql
07  new_developments_07_engagement.sql
08  new_developments_08_helpers_rpcs.sql
09  new_developments_09_storage_policies.sql
10  new_developments_10_email_stream.sql
```

`anon` receives **no grant and no policy** on any object in this set.

---

### 1.1 `01_accounts_members.sql`

```sql
-- Accounts -----------------------------------------------------------------
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
grant update (name, legal_name, billing_email, slug, updated_at)
  on public.development_accounts to authenticated;   -- no INSERT, no DELETE, no is_active/stripe_customer_id
grant all on public.development_accounts to service_role;

alter table public.development_accounts enable row level security;

-- Members ------------------------------------------------------------------
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

grant select, insert, update, delete on public.development_account_members to authenticated;
grant all on public.development_account_members to service_role;
alter table public.development_account_members enable row level security;

-- Helpers ------------------------------------------------------------------
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

revoke all on function public.is_eligible_agent(uuid) from public, anon, authenticated;
grant execute on function public.is_eligible_agent(uuid) to service_role;
revoke all on function public.current_is_eligible_agent() from public, anon;
grant execute on function public.current_is_eligible_agent() to authenticated, service_role;
revoke all on function public.is_development_member(uuid, text[]) from public, anon;
grant execute on function public.is_development_member(uuid, text[]) to authenticated, service_role;
revoke all on function public.is_development_account_active(uuid) from public, anon;
grant execute on function public.is_development_account_active(uuid) to authenticated, service_role;

-- Invariants ---------------------------------------------------------------
create or replace function public.enforce_immutable_development_membership()
returns trigger language plpgsql as $$
begin
  if new.account_id is distinct from old.account_id
     or new.user_id is distinct from old.user_id then
    raise exception 'development_account_members.account_id and user_id are immutable; delete and re-create the membership';
  end if;
  return new;
end $$;

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

create trigger trg_last_development_owner
before update or delete on public.development_account_members
for each row execute function public.enforce_last_development_owner();

-- No hard account deletion
create or replace function public.block_development_account_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'development_accounts rows are permanent; set is_active = false instead';
end $$;

create trigger trg_block_development_account_delete
before delete on public.development_accounts
for each row execute function public.block_development_account_delete();

-- System fields are admin/service only (defense in depth behind the column grant)
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

create trigger trg_development_account_system_fields
before update on public.development_accounts
for each row execute function public.guard_development_account_system_fields();

-- Atomic creation (no direct INSERT path)
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
grant execute on function public.create_development_account(text, text, uuid, text, text) to authenticated;

create or replace function public.admin_set_development_account_active(_account_id uuid, _is_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin role required';
  end if;
  update public.development_accounts set is_active = _is_active, updated_at = now()
   where id = _account_id;
end $$;
revoke all on function public.admin_set_development_account_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_development_account_active(uuid, boolean) to authenticated;

-- Policies -----------------------------------------------------------------
create policy "Members read their own account"
on public.development_accounts for select to authenticated
using (public.is_development_member(id) or public.has_role(auth.uid(),'admin'));

create policy "Owners edit their own organization details"
on public.development_accounts for update to authenticated
using ((public.is_development_member(id, array['owner']) and is_active)
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(id, array['owner']) and is_active)
       or public.has_role(auth.uid(),'admin'));

create policy "Members read their own membership rows"
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
```

Rollback: `drop trigger`/`drop function`/`drop table … cascade` in reverse order. Safe only while no developments exist (see §8.2).

---

### 1.2 `02_developments_core.sql`

Creates `public.developments` with the Revision 6 field set, `public.development_id_registry(id uuid primary key, created_at timestamptz not null default now())`, and:

```sql
-- explicit safe-column grants; admin_notes deliberately absent, no table-level SELECT
grant select (id, account_id, name, slug, slug_locked_at, lifecycle_status, publish_status,
              published_at, submitted_at, paused_at, archived_at, address, city, state,
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
              buyer_agent_compensation_notes, description, highlights, tier,
              created_by, updated_by)
  on public.developments to authenticated;

grant update (name, slug, lifecycle_status, publish_status, address, city, state, postal_code,
              latitude, longitude, neighborhood, neighborhood_description, logo_url,
              developer_name, architect_name, interior_designer_name, estimated_completion,
              delivery_from, delivery_to, total_units, total_buildings, stories, year_built,
              construction_type, building_details, amenities, parking_description,
              parking_included, pet_policy, hoa_fees, hoa_fee_min, hoa_fee_max, hoa_fee_includes,
              deposit_structure, incentives, buyer_agent_compensation,
              buyer_agent_compensation_notes, description, highlights, tier,
              updated_by, updated_at)
  on public.developments to authenticated;   -- account_id absent: no re-parenting

grant all on public.developments to service_role;
alter table public.developments enable row level security;
```

Triggers created in this file: `trg_development_account_immutable`, `trg_developments_permanent` (blocks DELETE, registry insert on create), `trg_development_publish_matrix` (the full actor/transition matrix plus `submitted_at`/`published_at`/`published_by`/`paused_at`/`archived_at` stamps), `trg_development_slug_lock`, `trg_developments_updated_at`, and `trg_development_default_phase` (deferred to file 03, created after the phases table exists).

Policies:

```sql
create policy "Eligible agents read published developments"
on public.developments for select to authenticated
using (publish_status = 'published'
       and public.is_development_account_active(account_id)
       and public.current_is_eligible_agent());

create policy "Members read their developments"
on public.developments for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

create policy "Owners and editors write their developments"
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
```

No DELETE policy (permanence trigger + no grant path that matters).

Helpers added here:

```sql
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
```

`can_agent_view_development()` is the single predicate every agent-facing child-table read policy and both Storage read policies call, so the publish + active + eligible triple can never drift apart.

---

### 1.3 `03_inventory.sql` / `1.4 04_updates.sql` / `1.5 05_media_documents.sql` / `1.6 06_sales_contacts.sql`

Tables exactly as specified in SSOT §2.3–§2.6 (no field, vocabulary, default, or index changes). Each file repeats the same four-part shape:

```sql
create table public.<child> ( … , unique (id, development_id) );

alter table public.<child>
  add constraint <child>_development_account_fk
  foreign key (development_id, account_id)
  references public.developments(id, account_id) on update cascade on delete cascade;

grant select, insert, update, delete on public.<child> to authenticated;
grant all on public.<child> to service_role;
alter table public.<child> enable row level security;

create policy "Eligible agents read <child> on published developments"
on public.<child> for select to authenticated
using (public.can_agent_view_development(development_id));

create policy "Members read their <child>"
on public.<child> for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

create policy "Owners and editors write <child>"
on public.<child> for all to authenticated
using ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'));
```

Per-table deltas from that template:
- **units:** `sales` gets read only; all sales mutation goes through §5.2. Adds `trg_development_unit_stamps` (`status_changed_at` / `price_changed_at`).
- **updates:** the agent read policy adds `and is_published`. Adds the Markdown/HTML guard and the first-publish stamp trigger, plus `create unique index uq_development_update_pinned on public.development_updates(development_id) where is_pinned;`
- **media:** XOR checks, `unique index uq_development_hero on public.development_media(development_id) where is_hero`, `unique index uq_development_media_object on public.development_media(development_id, storage_bucket, storage_path) where storage_path is not null`.
- **documents:** agent read policy is unchanged (metadata for both `access` values on a published, active development); bytes never come from the table — only §6.3.
- **sales_contacts:** agent read policy adds `and is_active`; partial unique indexes on `(development_id, lower(email)) where email is not null` and `(development_id) where is_primary and is_active`.
- **buildings_phases:** `is_default` partial unique index; `on delete restrict` from units.

---

### 1.7 `07_engagement.sql`

Saves/shares/leads/showing requests exactly as SSOT §2.7. Grants:

```sql
grant select, insert, delete on public.development_saves to authenticated;
grant all on public.development_saves to service_role;
grant select, insert on public.development_shares to authenticated;
grant all on public.development_shares to service_role;

grant select on public.development_leads to authenticated;                 -- no INSERT, no DELETE
grant update (status, assigned_contact_id, updated_at)
  on public.development_leads to authenticated;
grant all on public.development_leads to service_role;

grant select on public.development_showing_requests to authenticated;      -- no INSERT, no DELETE
grant update (status, assigned_contact_id, updated_at)
  on public.development_showing_requests to authenticated;
grant all on public.development_showing_requests to service_role;
```

Policies:

```sql
-- saves / shares: own rows only
create policy "Agents manage their own development saves"
on public.development_saves for all to authenticated
using (agent_user_id = auth.uid() and public.current_is_eligible_agent())
with check (agent_user_id = auth.uid()
            and public.current_is_eligible_agent()
            and public.can_agent_view_development(development_id));

-- leads / showings (identical shape on both tables)
create policy "Agents read their own submissions"
on public.development_leads for select to authenticated
using (agent_user_id = auth.uid() and public.current_is_eligible_agent());

create policy "Members read their account's leads"
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
```

Triage guard trigger (identical function reused by both tables):

```sql
create or replace function public.guard_development_submission_triage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.current_request_role() = 'service_role' then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.development_id is distinct from old.development_id
     or new.account_id is distinct from old.account_id
     or new.unit_id is distinct from old.unit_id
     or new.agent_user_id is distinct from old.agent_user_id
     or new.message is distinct from old.message
     or new.notified_at is distinct from old.notified_at
     or new.created_at is distinct from old.created_at
     or to_jsonb(new) - 'status' - 'assigned_contact_id' - 'updated_at'
        is distinct from to_jsonb(old) - 'status' - 'assigned_contact_id' - 'updated_at' then
    raise exception 'Only status and assigned_contact_id may be changed';
  end if;
  return new;
end $$;
```

---

### 1.8 `08_helpers_rpcs.sql`

Contains the sales reader, the narrow writer (with guardrail G1 applied — see §5.2), `get_development_engagement_summary`, and `admin_replace_development_owner`.

### 1.9 `09_storage_policies.sql` — see §4.  ### 1.10 `10_email_stream.sql` — see §7.

---

## 2. RLS/grant summary (unchanged from approved matrix)

The approved policy matrix in SSOT §3 is implemented verbatim. Two mechanical rules make it auditable:
1. **Every** agent read predicate is exactly `public.can_agent_view_development(development_id)` — never an inlined variant.
2. **Every** member write predicate is `is_development_member(account_id, <roles>) and is_development_account_active(account_id)`, admin-bypassed by `has_role(auth.uid(),'admin')`.

`anon`: zero grants, zero policies, on all 13 tables and both buckets.

---

## 3. Guardrail G1 in detail — disabled accounts

| Surface | Behavior when `is_active = false` |
|---|---|
| Table reads (members/admins) | allowed (recovery) |
| Table reads (eligible agents) | denied — `can_agent_view_development()` is false |
| Table writes (members) | denied by every write policy |
| `set_development_unit_status_price()` | denied for non-admin callers (**new check**) |
| Storage write (`development-media`, `development-documents`) | denied for members (**new check**) |
| Storage read `development-media` (agents) | denied (**new check**); members still read |
| `development-document-url` Path A (agent) | denied (**new check**) |
| `development-document-url` Path B (member) | allowed — recovery/preview, by design |
| Lead / showing submission | rejected 403 before insert |
| Flipping `is_active` back | admin RPC / `service_role` only |

---

## 4. Storage policies (proposed, no bucket created)

```sql
insert into storage.buckets (id, name, public) values
  ('development-media','development-media', false),
  ('development-documents','development-documents', false);
```

Path convention: `{development_id}/{scope}/{scope_id}/{uuid}.{ext}`.

```sql
create or replace function public.development_from_storage_path(_name text)
returns uuid language sql immutable as $$
  select nullif((storage.foldername(_name))[1], '')::uuid
$$;

-- shared write predicate: owner/editor of an ACTIVE account (guardrail G1)
create or replace function public.can_write_development_object(_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.developments d
    where d.id = public.development_from_storage_path(_name)
      and public.is_development_member(d.account_id, array['owner','editor'])
      and public.is_development_account_active(d.account_id)
  ) or public.has_role(auth.uid(),'admin');
$$;

-- shared member-read predicate: any accepted member, active or not (recovery)
create or replace function public.can_member_read_development_object(_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.developments d
    where d.id = public.development_from_storage_path(_name)
      and public.is_development_member(d.account_id)
  ) or public.has_role(auth.uid(),'admin');
$$;

-- development-media
create policy "dev media agent read"
on storage.objects for select to authenticated
using (bucket_id = 'development-media'
       and public.can_agent_view_development(public.development_from_storage_path(name)));

create policy "dev media member read"
on storage.objects for select to authenticated
using (bucket_id = 'development-media'
       and public.can_member_read_development_object(name));

create policy "dev media member write"
on storage.objects for insert to authenticated
with check (bucket_id = 'development-media' and public.can_write_development_object(name));

create policy "dev media member update"
on storage.objects for update to authenticated
using (bucket_id = 'development-media' and public.can_write_development_object(name))
with check (bucket_id = 'development-media' and public.can_write_development_object(name));

create policy "dev media member delete"
on storage.objects for delete to authenticated
using (bucket_id = 'development-media' and public.can_write_development_object(name));

-- development-documents: NO client select policy at all.
-- Bytes are reachable only through the 5-minute signed URL minted in §6.3.
create policy "dev docs member write"
on storage.objects for insert to authenticated
with check (bucket_id = 'development-documents' and public.can_write_development_object(name));

create policy "dev docs member update"
on storage.objects for update to authenticated
using (bucket_id = 'development-documents' and public.can_write_development_object(name))
with check (bucket_id = 'development-documents' and public.can_write_development_object(name));

create policy "dev docs member delete"
on storage.objects for delete to authenticated
using (bucket_id = 'development-documents' and public.can_write_development_object(name));
```

Note: signing in §6.3 is done with the service-role client, so the absent document SELECT policy does not block legitimate downloads — it only removes the direct client path.

---

## 5. RPCs

### 5.1 Reader — `get_development_sales_inventory(uuid)`
Unchanged from SSOT §5 (member/admin only, narrow projection).

### 5.2 Narrow writer — with guardrail G1

```sql
create type public.development_unit_write_result as (
  unit_id uuid, status text, price numeric,
  status_changed_at timestamptz, price_changed_at timestamptz, updated_at timestamptz
);

create or replace function public.set_development_unit_status_price(
  _unit_id uuid, _status text default null,
  _price numeric default null, _clear_price boolean default false
) returns public.development_unit_write_result
language plpgsql volatile security definer set search_path = public as $$
declare
  v_unit public.development_units;
  v_out  public.development_unit_write_result;
  v_is_admin boolean := public.has_role(auth.uid(),'admin');
begin
  if _clear_price and _price is not null then
    raise exception 'Pass either _price or _clear_price, not both';
  end if;

  select * into v_unit from public.development_units where id = _unit_id for update;
  if not found then raise exception 'Unit not found'; end if;

  if not v_is_admin then
    if not public.is_development_member(v_unit.account_id, array['owner','editor','sales']) then
      raise exception 'Not authorized';
    end if;
    -- Guardrail G1: a disabled account is read-only for its members, including here.
    if not public.is_development_account_active(v_unit.account_id) then
      raise exception 'This development account is disabled';
    end if;
  end if;

  if _status is not null and _status not in
     ('available','reserved','under_agreement','sold','coming_soon') then
    raise exception 'Invalid unit status';
  end if;
  if _price is not null and _price < 0 then raise exception 'Invalid price'; end if;

  update public.development_units
     set status = coalesce(_status, status),
         price  = case when _clear_price then null
                       when _price is not null then _price
                       else price end,
         updated_at = now()
   where id = _unit_id
  returning id, status, price, status_changed_at, price_changed_at, updated_at into v_out;

  return v_out;
end $$;
revoke all on function public.set_development_unit_status_price(uuid, text, numeric, boolean) from public, anon;
grant execute on function public.set_development_unit_status_price(uuid, text, numeric, boolean) to authenticated;
```

### 5.3 `get_development_engagement_summary(uuid)` and `admin_replace_development_owner(uuid, uuid)`
Unchanged from SSOT §2.7 / §2.1.

---

## 6. Edge Functions (code design, not deployed)

All three: `supabase/functions/<name>/index.ts`, `npm:@supabase/supabase-js@2`, `corsHeaders` imported from `npm:@supabase/supabase-js@2/cors`, `verify_jwt = false` in `supabase/config.toml` with **explicit in-code JWT validation**, Zod validation, service-role client instantiated only after authorization, persist-before-notify. No new secret: `TURNSTILE_SECRET_KEY` already exists; `_shared/verifyTurnstile.ts` is reused unmodified.

### 6.1 `development-lead-submit` (and `development-showing-request`, identical shape)

**Canonical order (guardrail G3):**

```
1. CORS preflight
2. getUser(jwt)            -> 401 if missing/invalid       [auth resolved FIRST]
3. Zod validate body       -> 400 (development_id, unit_id?, message?, source, turnstileToken)
4. verifyTurnstileToken()  -> 403 TURNSTILE_GENERIC_ERROR
5. rate limit              -> 429 + Retry-After            [needs auth.uid() from step 2]
6. eligibility: is_eligible_agent(user.id)                 -> 403
7. development: publish_status='published' AND account is_active -> 403
   (+ unit_id, if given, belongs to that development)
8. snapshot sender_name/email/phone from profiles/agent_settings (server-side)
9. INSERT development_leads (service role)                 -> row committed
10. resolve recipients: flagged active contacts -> primary active contact -> owner members
11. enqueue one email_jobs row per recipient (identity-keyed idempotency)
12. stamp notified_at ONLY if every enqueue succeeded
13. 200 { success: true, leadId }
```

**Rate-limit keys (guardrail G2) — per user, per development:**

```ts
const uid = user.id;
const dev = body.development_id;
await checkRateLimit(`route:development-lead-submit|development:${dev}|user:${uid}`, 600, 5);
await checkRateLimit(`route:development-lead-submit|development:${dev}|user:${uid}|day`, 86400, 20);
// IP backstop, still global by route (abuse control, not a per-project quota):
await checkRateLimit(`route:development-lead-submit|ip:${clientIp}`, 600, 30);
```

`development-showing-request` uses `route:development-showing-request|development:${dev}|user:${uid}` with the same windows, tier-1 filtered by `receives_showing_requests`, body fields `preferred_date` / `preferred_time` / `message`.

A rate-limit rejection happens **before** any insert and **before** any email enqueue; the `rate_limit_consume` RPC failing open (its existing behavior) is preserved so a limiter outage never blocks legitimate submissions.

**Notification idempotency keys:** `dev-lead:{lead_id}:contact:{sales_contact_id}` / `dev-lead:{lead_id}:owner:{owner_user_id}` (and `dev-showing:` equivalents). Addresses are lowercased and deduplicated before enqueue, contact identity winning over owner identity.

### 6.2 Recipient resolution helper
`supabase/functions/_shared/developmentRecipients.ts` — one exported `resolveDevelopmentRecipients(supabase, developmentId, channel)` implementing the three ordered tiers, returning `{ identityKind, identityId, email, name }[]`. Both submission functions import it; nothing else does.

### 6.3 `development-document-url`

```
1. CORS preflight
2. getUser(jwt) -> 401
3. Zod validate { document_id: uuid }
4. Load document + parent development (service role): development_id, account_id,
   publish_status, storage_path, is_active
5. Authorize:
   Path A (agent):  is_eligible_agent(user.id)
                    AND publish_status = 'published'
                    AND account.is_active          <-- guardrail G1 (new)
   Path B (member): accepted member of account.id, ANY publish_status,
                    regardless of is_active         <-- unchanged, recovery/preview
   Admin: authorized on either path
   else -> 403
6. createSignedUrl('development-documents', storage_path, 300)
7. 200 { url }   -- URL only, no bytes proxied, no access log table
```

Anonymous callers never reach step 5.

### 6.4 `supabase/config.toml` additions (proposed)

```toml
[functions.development-lead-submit]
verify_jwt = false

[functions.development-showing-request]
verify_jwt = false

[functions.development-document-url]
verify_jwt = false
```

---

## 7. Email-stream changes

- New stream value `development_notifications` registered in `10_email_stream.sql` alongside the existing streams used by `email_jobs` (`email_stream_for_template` / `email_jobs_enforce_stream` gain the new template names; no existing mapping is altered).
- New builder file `supabase/functions/_shared/buildDevelopmentNotificationEmailHtml.ts`. **No existing template file or shared builder is modified**, consistent with the standing template freeze.
- Two templates: `development_lead_notification`, `development_showing_request_notification`.
- The stream is independent of Hot Sheet and Comms Center streams and their pause flags; pausing one does not pause the others.
- No backfill, retry, or re-enqueue of any existing `email_jobs` row is part of this package.

---

## 8. Verification and rollback plan

### 8.1 Post-apply verification (read-only, to run after each approved migration)
1. `supabase--linter` — expect zero new findings; specifically zero "RLS disabled" and zero "policy allows anon".
2. Grant audit: for each of the 13 tables, assert `anon` has no privileges, and that `developments`, `development_accounts`, `development_leads`, `development_showing_requests` have **no** table-level `SELECT`/`INSERT`/`UPDATE` to `authenticated` where a column grant is claimed.
3. Negative tests as a non-member eligible agent: cannot read a `draft` development; cannot read a published development on an inactive account; cannot `INSERT` into `development_leads`; cannot read `admin_notes`.
4. Negative tests as a `sales` member: `UPDATE development_units` denied; `set_development_unit_status_price()` succeeds; after `admin_set_development_account_active(false)` the same RPC call fails with `This development account is disabled` (guardrail G1).
5. Owner invariant: demote/delete of the last owner raises; two concurrent demotions — one succeeds, one raises.
6. Immutability: `update developments set account_id = …` raises; `update development_account_members set user_id = …` raises; `delete from development_accounts` raises.
7. Triage: owner `UPDATE` of `status` succeeds; of `sender_email` or `notified_at` is rejected by grant and by trigger.
8. Storage: agent read of a media object on an inactive account denied; member read allowed; member write on an inactive account denied.
9. Rate limit: two identical submissions to **different** developments both allowed (guardrail G2); six to the same development within 10 minutes → the sixth returns 429.
10. Refresh `npm run db:snapshot` and re-run `scripts/check-schema-drift.sh`.

### 8.2 Rollback
- Each migration file carries a rollback block dropping only the objects it created, in reverse dependency order.
- Because the set is entirely additive and touches no existing table, a full rollback is `drop table public.development_* cascade` + `drop function public.<listed> ` + `drop policy … on storage.objects` + `delete from storage.buckets where id in (…)` (only valid while both buckets are empty).
- The permanence triggers (`block_development_account_delete`, developments delete guard) must be dropped **before** the tables during a rollback; the rollback block does this explicitly.
- Rollback is safe only before any real developer data exists. Once a live account exists, disable via `admin_set_development_account_active(false)` instead.

---

## 9. What is explicitly NOT in this package
- No migration executed, no bucket created, no policy or grant changed, no RPC or Edge Function created or deployed, no secret set, no frontend change or deploy.
- No Phase 2 items: invites table, buyer registration, public logged-out surface, `development_document_access` analytics.
- No change to `listings`, Hot Sheets, DCMLS, Comms Center, existing email templates, or any existing cron.
