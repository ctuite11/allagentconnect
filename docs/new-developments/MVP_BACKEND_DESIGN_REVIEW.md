# New Developments MVP — Backend Design Review Package
Status: PROPOSAL ONLY. Nothing applied. No migrations run, no buckets created, no functions deployed, no RLS changed, no secrets set.

Frozen SSOT constraints honored:
- Permanent `development_id` (never reused, never re-keyed).
- Separate inventory / content / engagement graph.
- No FK, trigger, RPC, view, or shared-table dependency on `listings`, Hot Sheets, listing favorites/shares/showings, DCMLS publishing, or agent membership billing.
- Admin controls publication.
- Save/share data exposed to developers in aggregate only.
- Agent identity and sales-team recipients resolved server-side.
- Persist-before-notify for all engagement.
- Normalized media and documents.
- Eligible AAC agent = **verified + activated** everywhere.
- At least one accepted `owner` per development account at all times.

---

## 1. Canonical eligibility helper

```sql
create or replace function public.is_eligible_agent(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.agent_settings s
    where s.user_id = _user_id
      and s.agent_status = 'verified'::agent_status
      and s.account_activated_at is not null
  );
$$;

create or replace function public.current_is_eligible_agent()
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_eligible_agent(auth.uid()) $$;
```
Every agent-facing policy below calls `public.current_is_eligible_agent()`. Verification alone is never sufficient. Admins bypass via existing `public.has_role(auth.uid(),'admin')`.

---

## 2. Schema (all tables in `public`, prefix `development_`)

### 2.1 Accounts and membership
```
development_accounts(id pk, name, slug uk, status, contact_email, created_at, updated_at)
development_account_members(
  id pk, account_id fk->development_accounts on delete cascade,
  user_id uuid not null,               -- no FK to auth.users
  role text check in ('owner','manager','sales'),
  invite_status text check in ('invited','accepted','revoked'),
  invited_by uuid, accepted_at, revoked_at, created_at, updated_at,
  unique(account_id, user_id)
)
```
Indexes: `(account_id, role) where invite_status='accepted'`, `(user_id) where invite_status='accepted'`.

**Last-owner protection** — trigger, not CHECK (needs cross-row state):
```sql
create or replace function public.enforce_last_development_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare remaining int;
begin
  if tg_op = 'DELETE' then
    if old.role <> 'owner' or old.invite_status <> 'accepted' then return old; end if;
  else
    if old.role = 'owner' and old.invite_status = 'accepted'
       and (new.role <> 'owner' or new.invite_status <> 'accepted') then
      null; -- falls through to the count check
    else
      return new;
    end if;
  end if;

  select count(*) into remaining
  from public.development_account_members m
  where m.account_id = coalesce(old.account_id, new.account_id)
    and m.role = 'owner' and m.invite_status = 'accepted'
    and m.id <> old.id;

  if remaining = 0 and not coalesce(current_setting('aac.admin_owner_recovery', true) = 'on', false) then
    raise exception 'A development account must retain at least one accepted owner';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger trg_last_development_owner
before update or delete on public.development_account_members
for each row execute function public.enforce_last_development_owner();
```
Admin recovery: a `security definer` RPC `admin_replace_development_owner(account_id, new_owner_user_id)` that asserts `has_role(auth.uid(),'admin')`, inserts/promotes the replacement first, then performs the demotion inside a `set_config('aac.admin_owner_recovery','on', true)` scope. Ordinary member management can never reach zero owners.

### 2.2 Developments (permanent id)
```
developments(
  id uuid pk default gen_random_uuid(),      -- permanent, never reused
  account_id fk->development_accounts,
  name, slug uk, status text check in ('draft','submitted','published','archived'),
  published_at, published_by uuid,           -- admin only
  address, city, state, postal_code, latitude, longitude,
  delivery_from date, delivery_to date,
  description, highlights jsonb default '[]',
  created_at, updated_at,
  unique(id, account_id)                     -- composite FK target
)
```
- Permanence: no `ON DELETE CASCADE` from account to developments (use `on delete restrict`); archival is a status change. A `development_id_registry(id pk, created_at)` insert-only table plus a `before delete` trigger blocking hard deletes guarantees ids are never reused.
- Admin publication: `before update` trigger rejects any transition into/out of `published` unless `has_role(auth.uid(),'admin')`, and stamps `published_at/published_by`.

### 2.3 Inventory (separate graph, zero listings coupling)
```
development_buildings(id pk, development_id, account_id, name, ..., unique(id, development_id))
development_unit_types(id pk, development_id, account_id, name, beds, baths numeric, sqft int,
  price_min numeric, price_max numeric, unique(id, development_id),
  check (price_min is null or price_max is null or price_min <= price_max))
development_units(
  id pk, development_id, building_id, unit_type_id, account_id,
  unit_number text not null, floor int, beds int, baths numeric, sqft int,
  price numeric check (price is null or price >= 0),
  availability text check in ('available','reserved','sold','held','coming_soon'),
  unique(development_id, unit_number))
```
Composite FKs enforce that children cannot cross developments:
```sql
alter table public.development_units
  add constraint development_units_building_fk
  foreign key (building_id, development_id)
  references public.development_buildings(id, development_id) on delete set null;
-- same pattern for unit_type_id, and for buildings/unit_types -> developments(id, account_id)
```

### 2.4 Content: normalized media and documents
```
development_media(id pk, development_id, account_id, owner_kind check in ('development','building','unit_type','unit'),
  owner_id uuid, kind check in ('image','video','floorplan','render'),
  storage_path text not null, width int, height int, alt text, sort_order int default 0, created_by, created_at,
  unique(development_id, storage_path))
development_documents(id pk, development_id, account_id, title, doc_type
  check in ('brochure','floorplan','price_sheet','hoa','offering','other'),
  storage_path text not null, byte_size bigint, mime_type text,
  visibility text check in ('agents','public') default 'agents',
  created_by, created_at, unique(development_id, storage_path))
```
A `before insert/update` trigger validates `owner_id` resolves inside the same `development_id` for the given `owner_kind`.

### 2.5 Engagement (persist-before-notify)
```
development_saves(id pk, development_id, agent_user_id, created_at, unique(development_id, agent_user_id))
development_shares(id pk, development_id, agent_user_id, channel, created_at)
development_leads(id pk, development_id, unit_id null, agent_user_id, account_id,
  buyer_name, buyer_email, buyer_phone, message,
  status check in ('new','contacted','qualified','closed','archived') default 'new',
  notified_at timestamptz null, created_at, updated_at)
development_showings(id pk, development_id, unit_id null, agent_user_id, account_id,
  requested_at timestamptz not null, alternate_at timestamptz,
  status check in ('requested','confirmed','declined','cancelled','completed') default 'requested',
  notified_at timestamptz null, created_at, updated_at)
development_document_access(id pk, document_id, development_id, agent_user_id, accessed_at)
```
`notified_at` is written only after the email job is enqueued; the row is committed first. No email is ever sent without a persisted row.

Aggregate-only privacy: developers never read `development_saves` / `development_shares` rows. Exposure is a `security definer` RPC only:
```sql
create or replace function public.get_development_engagement_summary(_development_id uuid)
returns table(saves_count int, shares_count int, leads_count int, showings_count int)
language sql stable security definer set search_path = public as $$ ... $$;
```
Returns counts only, suppressed (returns 0/null) below a threshold of 5 to prevent re-identification. Callable by accepted account members of that development and admins.

---

## 3. RLS design (every table: GRANT, then ENABLE RLS, then policies)

Helper functions (all `security definer`, `stable`, `set search_path = public`):
- `is_development_member(_account_id uuid, _roles text[] default null)` — accepted membership check.
- `development_account_id(_development_id uuid)` — resolves the owning account.
- `is_published_development(_development_id uuid)`.

Grants per table: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;`. **No `anon` grant on any development table** — the public marketing surface reads through a `security definer` RPC, not the Data API.

Policy matrix (SELECT / write):
| Table | Agents (verified+activated) | Account members | Admin |
|---|---|---|---|
| developments | SELECT where `status='published'` | full CRUD on own account rows, except `status`/`published_*` | all |
| buildings / unit_types / units | SELECT where parent published | CRUD on own account | all |
| media | SELECT where parent published | CRUD on own account | all |
| documents | SELECT where parent published (path signed separately) | CRUD on own account | all |
| saves / shares | insert/select/delete **own rows only** (`agent_user_id = auth.uid()`) | **no row access** (aggregate RPC only) | all |
| leads / showings | insert own; select own | select/update own account's rows | all |
| account_members | — | select own account; owners manage | all |

Publication-state guard on developer writes: a `WITH CHECK` clause plus trigger blocks members from setting `status='published'`, `published_at`, or `published_by`.

Agent read policies all take the form:
```sql
create policy "Eligible agents read published developments"
on public.developments for select to authenticated
using (status = 'published' and public.current_is_eligible_agent());
```

---

## 4. Storage design (proposal only — no buckets created)

Two **private** buckets:
- `development-media` — images/renders/floorplan images.
- `development-documents` — PDFs and price sheets.

Path convention (first segment is the development id, so policies parse it):
`{development_id}/{owner_kind}/{owner_id}/{uuid}.{ext}`

Policies on `storage.objects` keyed on `(storage.foldername(name))[1]::uuid`:
- INSERT/UPDATE/DELETE: accepted member (`owner`/`manager`) of the account owning that development.
- SELECT on `development-media`: eligible agents when the development is published; members always; admins always.
- SELECT on `development-documents`: **no direct client select.** Access is only via signed URLs minted by an Edge Function after logging `development_document_access`. Expiry 5 minutes, single document per call.

---

## 5. Narrow sales inventory RPC

Sales-role members must not read the full graph. One narrow, column-limited RPC:
```sql
create or replace function public.get_development_sales_inventory(_development_id uuid)
returns table(
  unit_id uuid, unit_number text, building_name text, unit_type_name text,
  beds int, baths numeric, sqft int, price numeric, availability text
)
language sql stable security definer set search_path = public
as $$
  select u.id, u.unit_number, b.name, t.name, u.beds, u.baths, u.sqft, u.price, u.availability
  from public.development_units u
  left join public.development_buildings b on b.id = u.building_id
  left join public.development_unit_types t on t.id = u.unit_type_id
  where u.development_id = _development_id
    and (
      public.is_development_member(public.development_account_id(_development_id), array['owner','manager','sales'])
      or public.has_role(auth.uid(),'admin')
    );
$$;
revoke all on function public.get_development_sales_inventory(uuid) from public, anon;
grant execute on function public.get_development_sales_inventory(uuid) to authenticated;
```
No buyer PII, no engagement data, no internal cost fields.

---

## 6. Edge Function architecture (design only)

All four follow the same shape: `npm:@supabase/supabase-js@2/cors`, JWT validated in code (`verify_jwt=false` + explicit `getUser`), Zod validation, service-role client used only after authorization, persist-before-notify.

1. **`development-lead-submit`** — validate body → resolve `agent_user_id` from the JWT (never from the body) → assert `is_eligible_agent` → assert development published → insert `development_leads` → resolve sales recipients server-side from `development_account_members` (accepted, roles `owner`/`manager`/`sales`) joined to profiles → enqueue `email_jobs` with idempotency key `dev-lead:{lead_id}:{recipient_user_id}` → stamp `notified_at`.
2. **`development-showing-request`** — identical flow against `development_showings`, key `dev-showing:{showing_id}:{recipient_user_id}`.
3. **`development-document-url`** — assert eligible agent + published + `visibility='agents'` → insert `development_document_access` → mint 5-minute signed URL → return URL only.
4. **`development-member-invite`** — owner-only; creates `invited` membership and enqueues invite email. Acceptance flows through a separate `security definer` RPC that stamps `accepted_at`.

Emails reuse the existing `email_jobs` queue and the AAC Unified template with a new dedicated stream (`development_notifications`) so Hot Sheet / Comms Center streams and pauses stay untouched. **No template file or shared builder is modified**; a new builder file is added for this stream only.

---

## 7. Migration sequence (proposed file names, not applied)

1. `2026XXXXXXXX_new_developments_01_accounts_members.sql` — accounts, members, last-owner trigger, grants, RLS.
2. `..._02_developments_core.sql` — developments, id registry, permanence + publication triggers.
3. `..._03_inventory.sql` — buildings, unit_types, units, composite FKs.
4. `..._04_media_documents.sql` — normalized content tables + owner validation trigger.
5. `..._05_engagement.sql` — saves, shares, leads, showings, document access.
6. `..._06_helpers_rpcs.sql` — eligibility/membership helpers, sales inventory RPC, aggregate summary RPC, admin owner recovery RPC.
7. `..._07_storage_policies.sql` — bucket creation + storage policies.
8. `..._08_email_stream.sql` — `development_notifications` stream registration only.

Each includes an updated_at trigger and a rollback note. Snapshot (`npm run db:snapshot`) refreshed after apply.

---

## 8. Explicit non-couplings verified in this design
- No column, FK, view, trigger, RPC, or policy references `listings`, `hot_sheets`, `hot_sheet_*`, `favorites`, `listing_shares`, `showing_requests`, `seller_matches`, DCMLS publish flags, or membership/billing tables.
- Engagement uses its own tables; nothing writes to listing stats or Hot Sheet delivery tables.
- The only shared infrastructure touched is `email_jobs` (new stream), `agent_settings` (read-only eligibility check), `user_roles`/`has_role` (admin check), and `profiles` (read-only recipient name/email).

## 9. Open questions for approval
1. Aggregate suppression threshold — proposed 5. Confirm or set another value.
2. Should `sales`-role members see buyer contact details on leads, or name + masked contact until they claim the lead?
3. Public (logged-out) marketing surface for published developments — in MVP scope or agent-only?
4. Signed document URL TTL — proposed 5 minutes.
