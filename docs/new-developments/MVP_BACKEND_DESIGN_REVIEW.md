# New Developments MVP — Backend Design Review Package (Revision 2)
Status: PROPOSAL ONLY. Nothing applied. No migrations run, no buckets created, no functions deployed, no RLS changed, no secrets set.

Revision 2 reconciles this package with the frozen SSOT. All 12 divergences flagged in review are corrected, the two backend/security corrections are applied, the four open questions are closed, and `development_document_access` is removed from MVP scope.

Frozen SSOT constraints honored:
- Permanent `development_id` (never reused, never re-keyed).
- Separate inventory / content / engagement graph.
- No FK, trigger, RPC, view, or shared-table dependency on `listings`, Hot Sheets, listing favorites/shares/showings, DCMLS publishing, or agent membership billing.
- Admin controls publication.
- Save/share data exposed to developers in aggregate only (exact counts, no agent identity).
- Sales-team recipients resolved server-side from `development_sales_contacts`.
- Persist-before-notify for all engagement.
- Normalized media and documents.
- Eligible AAC agent = **verified + activated** everywhere.
- At least one `owner` per development account at all times, enforced concurrency-safely.
- Agents-only MVP. No logged-out public surface. No buyer registration. Invites are Phase 2.

---

## 0. Decisions closed in this revision

| Question | Decision |
|---|---|
| Aggregate suppression threshold | **None.** Exact save/share counts, including 1. Privacy comes from withholding agent identity. |
| Lead/showing contact visibility | **Full AAC agent contact info** to owner/editor/sales. This is agent contact data, not buyer PII. No claim-before-reveal step. |
| Logged-out public marketing | **Out of scope.** `public_marketing` remains a forward-looking document flag only; it grants no anonymous access today. No public SECURITY DEFINER surface in MVP. |
| Signed document URL TTL | **5 minutes.** |
| `development_document_access` | **Removed from MVP.** Analytics/event tracking is deferred; no security requirement forces it. |

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

-- Security correction: the parameterized form is privileged-only.
revoke all on function public.is_eligible_agent(uuid) from public, anon, authenticated;
grant execute on function public.is_eligible_agent(uuid) to service_role;

revoke all on function public.current_is_eligible_agent() from public, anon;
grant execute on function public.current_is_eligible_agent() to authenticated, service_role;
```
Every agent-facing policy calls `public.current_is_eligible_agent()`. Verification alone is never sufficient. Admins bypass via existing `public.has_role(auth.uid(),'admin')`. Other SECURITY DEFINER functions that need the parameterized helper call it as their (privileged) owner, which is unaffected by the revoke.

---

## 2. Schema (all tables in `public`, prefix `development_`)

### 2.1 Accounts and membership — accepted members only

```
development_accounts(id pk, name, slug uk, status, contact_email, created_at, updated_at)

development_account_members(
  id pk,
  account_id  fk->development_accounts on delete cascade,
  user_id     uuid not null references auth.users(id) on delete restrict,
  role        text not null check (role in ('owner','editor','sales','viewer')),
  invited_by  uuid,
  created_at, updated_at,
  unique(account_id, user_id)
)
```
- **No `invite_status`.** A row in this table means an accepted member. There is no invited/revoked membership state; revocation is a delete.
- **Pending invites are Phase 2** in a separate `development_account_invites` table, not built in MVP.
- `user_id` keeps its FK to `auth.users` with `on delete restrict` so membership rows cannot be orphaned.

Indexes: `(account_id, role)`, `(user_id)`.

**Last-owner protection — concurrency-safe trigger** (no caller-settable bypass):
```sql
create or replace function public.enforce_last_development_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_account_id uuid := coalesce(old.account_id, new.account_id);
  remaining int;
begin
  -- Only demotions/removals of an owner can violate the invariant.
  if tg_op = 'UPDATE'
     and not (old.role = 'owner' and new.role <> 'owner') then
    return new;
  end if;
  if tg_op = 'DELETE' and old.role <> 'owner' then
    return old;
  end if;

  -- Serialize all owner mutations for this account: lock the parent account row.
  perform 1 from public.development_accounts
   where id = v_account_id for update;

  select count(*) into remaining
  from public.development_account_members m
  where m.account_id = v_account_id
    and m.role = 'owner'
    and m.id <> old.id;

  if remaining = 0 then
    raise exception 'A development account must retain at least one owner';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger trg_last_development_owner
before update or delete on public.development_account_members
for each row execute function public.enforce_last_development_owner();
```
Two concurrent demotions cannot both succeed: each takes `FOR UPDATE` on the same `development_accounts` row before counting, so the second transaction re-reads post-commit state and fails.

**Admin recovery without a bypass flag:** `admin_replace_development_owner(_account_id uuid, _new_owner_user_id uuid)` is `security definer`, asserts `has_role(auth.uid(),'admin')`, and **promotes/inserts the replacement owner first**. Once a second owner exists, demoting the prior owner satisfies the invariant naturally. `current_setting('aac.admin_owner_recovery')` is removed entirely — a caller-settable GUC is not an authorization boundary.

### 2.2 Developments (permanent id, two independent status fields)

```
developments(
  id uuid pk default gen_random_uuid(),      -- permanent, never reused
  account_id fk->development_accounts on delete restrict,
  name text not null,
  slug text unique not null,
  slug_locked_at timestamptz,                -- set on first publish
  lifecycle_status text not null default 'coming_soon'
    check (lifecycle_status in ('coming_soon','pre_construction','under_construction','now_selling','completed')),
  publish_status text not null default 'draft'
    check (publish_status in ('draft','pending_review','published','paused','archived')),
  published_at timestamptz, published_by uuid,   -- admin only, first publish stamp
  address, city, state, postal_code, latitude, longitude,
  delivery_from date, delivery_to date,
  description text, highlights jsonb not null default '[]',
  created_at, updated_at,
  unique(id, account_id)                     -- composite FK target
)
```
- `lifecycle_status` and `publish_status` are **independent**. Nothing collapses them; a `completed` development can be `paused`, a `now_selling` one can be `draft`.
- **Slug locking:** a `before update` trigger sets `slug_locked_at = now()` on the first transition to `published`, and rejects any `slug` change once `slug_locked_at is not null` (admins included, to preserve link permanence).
- **Admin publication:** a `before update` trigger rejects any transition into or out of `published` unless `has_role(auth.uid(),'admin')`, and stamps `published_at`/`published_by` on first publish only. Members may move between `draft` and `pending_review`; `paused` and `archived` are admin transitions.
- **Permanence:** account→developments is `on delete restrict`; archival is a `publish_status` change. `development_id_registry(id pk, created_at)` (insert-only) plus a `before delete` trigger blocking hard deletes guarantees ids are never reused.

### 2.3 Inventory — frozen names and uniqueness

```
development_buildings_phases(
  id pk, development_id, account_id,
  name text not null,
  is_default boolean not null default false,   -- the automatic "Main" phase
  sort_order int not null default 0,
  unique(id, development_id),
  unique(development_id, name)
)

development_floor_plans(
  id pk, development_id, account_id,
  name text not null,
  beds numeric(4,1), baths numeric(4,1), sqft int,
  price_min numeric(12,2), price_max numeric(12,2),
  unique(id, development_id),
  check (price_min is null or price_max is null or price_min <= price_max)
)

development_units(
  id pk, development_id, account_id,
  building_phase_id uuid not null,
  floor_plan_id uuid,
  unit_number text not null,
  floor text,                                  -- text-capable: 'PH', 'G', '12'
  beds numeric(4,1), baths numeric(4,1), sqft int,
  price numeric(12,2) check (price is null or price >= 0),
  status text not null default 'available'
    check (status in ('available','reserved','under_agreement','sold','coming_soon')),
  created_at, updated_at,
  unique(id, development_id),
  unique(development_id, building_phase_id, unit_number)   -- Building A/2A ≠ Building B/2A
)
```
- **No `held` status.** The frozen five-value vocabulary stands.
- **Automatic Main phase:** an `after insert` trigger on `developments` creates one `development_buildings_phases` row named `Main` with `is_default = true`, so `building_phase_id` can be `NOT NULL` from the first unit onward. A partial unique index enforces one default phase per development.
- **Phase deletion is blocked while units reference it:** the composite FK uses `on delete restrict`, not `set null`. The default phase additionally cannot be deleted while it is the only phase.

Composite FKs keep children inside their development:
```sql
alter table public.development_units
  add constraint development_units_phase_fk
  foreign key (building_phase_id, development_id)
  references public.development_buildings_phases(id, development_id) on delete restrict;

alter table public.development_units
  add constraint development_units_floor_plan_fk
  foreign key (floor_plan_id, development_id)
  references public.development_floor_plans(id, development_id) on delete set null;

-- phases/floor plans -> developments(id, account_id) follows the same pattern
```

### 2.4 Updates

```
development_updates(
  id pk, development_id, account_id,
  kind text not null
    check (kind in ('construction','sales','milestone','pricing','event','general')),
  title text not null,
  body_markdown text not null,                 -- Markdown only; raw HTML rejected by trigger
  posted_at timestamptz not null default now(),
  is_published boolean not null default false,
  published_at timestamptz,                    -- stamped on first publish, never rewritten
  is_pinned boolean not null default false,
  created_by uuid, created_at, updated_at,
  unique(id, development_id)
)
```
- **One pinned update per development:** `create unique index ... on development_updates(development_id) where is_pinned;`
- **No `sort_override`.** Ordering is pinned-first, then `posted_at desc`.
- A `before insert/update` trigger rejects `body_markdown` containing HTML tags and stamps `published_at` only on the first `is_published` transition.

### 2.5 Content: media and documents

```
development_media(
  id pk, development_id, account_id,
  floor_plan_id uuid, unit_id uuid, update_id uuid,   -- all nullable; XOR ownership
  kind text not null check (kind in ('photo','video','virtual_tour','video_poster')),
  source_type text not null check (source_type in ('storage','external')),
  storage_path text, external_url text,
  is_hero boolean not null default false,             -- development-level hero SSOT
  width int, height int, alt text,
  sort_order int not null default 0,
  created_by, created_at, updated_at,
  check (
    (floor_plan_id is not null)::int
  + (unit_id is not null)::int
  + (update_id is not null)::int <= 1                 -- 0 = development-level media
  ),
  check (
    (source_type = 'storage' and storage_path is not null and external_url is null)
 or (source_type = 'external' and external_url is not null and storage_path is null)
  ),
  check (not is_hero or (floor_plan_id is null and unit_id is null and update_id is null))
)
```
- **Exactly one hero per development:** `create unique index ... on development_media(development_id) where is_hero;` Hero is development-level only.
- Composite FKs for each optional parent:
```sql
foreign key (floor_plan_id, development_id) references public.development_floor_plans(id, development_id) on delete cascade
foreign key (unit_id,       development_id) references public.development_units(id, development_id)       on delete cascade
foreign key (update_id,     development_id) references public.development_updates(id, development_id)     on delete cascade
```
- `unique(development_id, storage_path)` where `storage_path is not null`.

```
development_documents(
  id pk, development_id, account_id,
  title text not null,
  category text not null check (category in (
    'broker_registration',
    'buyer_agent_compensation',
    'commission_bonus',
    'showing_tour_procedure',
    'sales_office_hours',
    'offer_submission',
    'deposit_schedule',
    'floor_plan_pdf',
    'price_sheet',
    'site_plan',
    'hoa_condo_docs',
    'offering_plan',
    'brochure',
    'other'
  )),
  access text not null default 'agent_only' check (access in ('agent_only','public_marketing')),
  floor_plan_id uuid,                          -- floor-plan PDFs attach through documents
  storage_path text not null, byte_size bigint, mime_type text,
  sort_order int not null default 0,
  created_by, created_at, updated_at,
  unique(development_id, storage_path),
  foreign key (floor_plan_id, development_id)
    references public.development_floor_plans(id, development_id) on delete set null
)
```
This is the agent-resource model: documents exist primarily to answer "how do I register my buyer, what am I paid, how do I tour, how do I submit an offer." `public_marketing` is stored but grants no anonymous access in MVP.

### 2.6 Sales contacts (routing SSOT)

```
development_sales_contacts(
  id pk, development_id, account_id,
  name text not null,
  email text not null,
  phone text,
  title text,
  user_id uuid references auth.users(id) on delete set null,  -- optional; contacts need not be AAC users
  is_active boolean not null default true,
  receives_leads boolean not null default true,
  receives_showing_requests boolean not null default true,
  sort_order int not null default 0,
  created_at, updated_at,
  unique(id, development_id),
  unique(development_id, lower(email))
)
```
**Routing rule (server-side only):** leads go to active contacts with `receives_leads`; showings to active contacts with `receives_showing_requests`. If that set is empty, and only then, fall back to the account's `owner` members. Account membership role is never itself a routing signal.

### 2.7 Engagement (agent actions, persist-before-notify)

```
development_saves(id pk, development_id, agent_user_id, created_at,
  unique(development_id, agent_user_id))

development_shares(id pk, development_id, unit_id null, agent_user_id,
  share_type text not null check (share_type in ('email','sms','copy_link','social','other')),
  created_at,
  foreign key (unit_id, development_id) references public.development_units(id, development_id) on delete set null)

development_leads(
  id pk, development_id, account_id, unit_id null,
  agent_user_id uuid not null,                 -- authoritative, from JWT
  sender_name text not null,                   -- server-snapshotted from the agent profile
  sender_email text not null,
  sender_phone text,
  message text,
  source text not null check (source in ('development_page','unit_page','share_link','document_gate','other')),
  status text not null default 'new'
    check (status in ('new','contacted','qualified','tour_scheduled','registered','closed','archived')),
  assigned_contact_id uuid,                    -- human assignment only; never routing
  notified_at timestamptz, created_at, updated_at,
  foreign key (unit_id, development_id) references public.development_units(id, development_id) on delete set null,
  foreign key (assigned_contact_id, development_id)
    references public.development_sales_contacts(id, development_id) on delete set null)

development_showings(
  id pk, development_id, account_id, unit_id null,
  agent_user_id uuid not null,
  requester_name text not null,                -- server-snapshotted
  requester_email text not null,
  requester_phone text,
  preferred_date date,
  preferred_time text,                         -- intentionally loose: "afternoon", "after 5"
  message text,
  status text not null default 'requested'
    check (status in ('requested','confirmed','declined','cancelled','completed')),
  assigned_contact_id uuid,
  notified_at timestamptz, created_at, updated_at,
  foreign key (unit_id, development_id) references public.development_units(id, development_id) on delete set null,
  foreign key (assigned_contact_id, development_id)
    references public.development_sales_contacts(id, development_id) on delete set null)
```
- **No buyer fields.** Buyer registration is not MVP; leads and showings are AAC-agent actions. Name/email/phone are the *agent's*, snapshotted server-side at insert so later profile edits don't rewrite history.
- `agent_user_id` always comes from the verified JWT, never the request body.
- `notified_at` is stamped only after the email job is enqueued; the row commits first.

**Aggregate-only engagement exposure — no suppression threshold:**
```sql
create or replace function public.get_development_engagement_summary(_development_id uuid)
returns table(saves_count int, shares_count int, leads_count int, showings_count int)
language sql stable security definer set search_path = public as $$ ... $$;
```
Exact counts, including 1. Developers never read `development_saves` / `development_shares` rows, so agent identity stays withheld. Callable by members of that development's account and admins.

---

## 3. RLS design (every table: GRANT, then ENABLE RLS, then policies)

Helper functions (all `security definer`, `stable`, `set search_path = public`):
- `is_development_member(_account_id uuid, _roles text[] default null)`
- `development_account_id(_development_id uuid)`
- `is_published_development(_development_id uuid)` — `publish_status = 'published'`

Grants per table: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;`. **No `anon` grant on any development table** — agents-only MVP.

Policy matrix:

| Table | Eligible agents | owner / editor | sales | viewer | Admin |
|---|---|---|---|---|---|
| developments | SELECT where `publish_status='published'` | CRUD on own account, except `publish_status='published'`, `published_*`, locked `slug` | read | read | all |
| buildings_phases / floor_plans | SELECT where parent published | CRUD | read | read | all |
| units | SELECT where parent published | **CRUD** | **read + narrow status/price RPC only** | read | all |
| updates | SELECT where parent published and `is_published` | CRUD | read | read | all |
| media | SELECT where parent published | CRUD | read | read | all |
| documents | SELECT where parent published and `access='agent_only'` (bytes via signed URL) | CRUD | read | read | all |
| sales_contacts | **no access** | CRUD | read | read | all |
| saves / shares | insert/select/delete own rows only | **no row access** (aggregate RPC) | no row access | no row access | all |
| leads / showings | insert own; select own | select + update own account's rows (status, assignment) | **select + update** own account's rows | read | all |
| account_members | — | select own account; owners manage | select own account | select own account | all |

- **No broad sales UPDATE on units.** Sales-role members have `SELECT` only; all sales-side mutation goes through the narrow RPC in §5.
- Full AAC agent contact details on leads/showings are visible to owner/editor/sales (decision 2).
- Publication guard: a `WITH CHECK` clause plus trigger blocks members from writing `publish_status='published'`, `published_at`, `published_by`, or a locked `slug`.

Agent read policies all take the form:
```sql
create policy "Eligible agents read published developments"
on public.developments for select to authenticated
using (publish_status = 'published' and public.current_is_eligible_agent());
```

---

## 4. Storage design (proposal only — no buckets created)

Two **private** buckets:
- `development-media` — photos, video posters, virtual-tour assets (external tours store a URL instead).
- `development-documents` — PDFs and price sheets.

Path convention (first segment is the development id, so policies parse it):
`{development_id}/{scope}/{scope_id}/{uuid}.{ext}` where `scope ∈ development | floor_plan | unit | update | document`.

Policies on `storage.objects` keyed on `(storage.foldername(name))[1]::uuid`:
- INSERT/UPDATE/DELETE: `owner`/`editor` member of the account owning that development.
- SELECT on `development-media`: eligible agents when the development is published; members always; admins always.
- SELECT on `development-documents`: **no direct client select.** Access is only via a **5-minute** signed URL minted by an Edge Function, one document per call. No access-logging table in MVP.

---

## 5. Sales RPCs — one reader, one narrow writer

**Reader** (unchanged in intent, updated to frozen column names):
```sql
create or replace function public.get_development_sales_inventory(_development_id uuid)
returns table(
  unit_id uuid, unit_number text, phase_name text, floor_plan_name text,
  floor text, beds numeric, baths numeric, sqft int, price numeric, status text
)
language sql stable security definer set search_path = public
as $$
  select u.id, u.unit_number, p.name, f.name, u.floor, u.beds, u.baths, u.sqft, u.price, u.status
  from public.development_units u
  join public.development_buildings_phases p on p.id = u.building_phase_id
  left join public.development_floor_plans f on f.id = u.floor_plan_id
  where u.development_id = _development_id
    and (
      public.is_development_member(public.development_account_id(_development_id),
        array['owner','editor','sales','viewer'])
      or public.has_role(auth.uid(),'admin')
    );
$$;
revoke all on function public.get_development_sales_inventory(uuid) from public, anon;
grant execute on function public.get_development_sales_inventory(uuid) to authenticated;
```

**Narrow writer** — the only path by which a sales member changes inventory:
```sql
create or replace function public.set_development_unit_status_price(
  _unit_id uuid,
  _status  text default null,
  _price   numeric default null
) returns public.development_units
language plpgsql volatile security definer set search_path = public as $$
declare v_unit public.development_units;
begin
  select * into v_unit from public.development_units where id = _unit_id for update;
  if not found then raise exception 'Unit not found'; end if;

  if not (
    public.is_development_member(v_unit.account_id, array['owner','editor','sales'])
    or public.has_role(auth.uid(),'admin')
  ) then
    raise exception 'Not authorized';
  end if;

  if _status is not null and _status not in
     ('available','reserved','under_agreement','sold','coming_soon') then
    raise exception 'Invalid unit status';
  end if;
  if _price is not null and _price < 0 then
    raise exception 'Invalid price'; end if;

  update public.development_units
     set status = coalesce(_status, status),
         price  = coalesce(_price, price),
         updated_at = now()
   where id = _unit_id
  returning * into v_unit;

  return v_unit;
end $$;
revoke all on function public.set_development_unit_status_price(uuid, text, numeric) from public, anon;
grant execute on function public.set_development_unit_status_price(uuid, text, numeric) to authenticated;
```
Only `status` and `price` are mutable through this path. No unit number, phase, floor plan, or dimension changes.

---

## 6. Edge Function architecture (design only) — three functions

All follow the same shape: `npm:@supabase/supabase-js@2`, CORS, JWT validated in code (`verify_jwt=false` + explicit `getUser`), Zod validation, service-role client used only after authorization, persist-before-notify.

1. **`development-lead-submit`** — validate body → resolve `agent_user_id` from the JWT (never the body) → assert eligible agent → assert development published → snapshot `sender_name/email/phone` from the agent profile server-side → insert `development_leads` → resolve recipients from `development_sales_contacts` where `is_active and receives_leads`, falling back to account `owner` members only if that set is empty → enqueue `email_jobs` with idempotency key `dev-lead:{lead_id}:{recipient_email}` → stamp `notified_at`.
2. **`development-showing-request`** — identical flow against `development_showings` (`preferred_date`, `preferred_time` text, `message`), recipients filtered by `receives_showing_requests`, key `dev-showing:{showing_id}:{recipient_email}`.
3. **`development-document-url`** — assert eligible agent + development published + `access='agent_only'` → mint a 5-minute signed URL → return URL only. No logging table.

**`development-member-invite` is removed.** Invites are Phase 2; MVP has no invited-membership state to create.

Emails reuse the existing `email_jobs` queue with a new dedicated stream (`development_notifications`) so Hot Sheet / Comms Center streams and pauses stay untouched. **No existing template file or shared builder is modified**; a new builder file is added for this stream only.

---

## 7. Migration sequence (proposed file names, not applied)

1. `..._new_developments_01_accounts_members.sql` — accounts, members (accepted-only, 4 roles), concurrency-safe last-owner trigger, grants, RLS.
2. `..._02_developments_core.sql` — developments with `lifecycle_status` + `publish_status`, id registry, permanence / publication / slug-lock triggers.
3. `..._03_inventory.sql` — buildings_phases (auto **Main**), floor_plans, units, composite FKs with `on delete restrict` on phase.
4. `..._04_updates.sql` — development_updates, pinned-unique index, Markdown guard, first-publish stamp.
5. `..._05_media_documents.sql` — media (XOR ownership, storage/external, hero unique) and documents (agent-resource categories).
6. `..._06_sales_contacts.sql` — sales contacts + routing indexes.
7. `..._07_engagement.sql` — saves, shares (with `unit_id`), leads, showings.
8. `..._08_helpers_rpcs.sql` — eligibility/membership helpers and grants, sales inventory reader, narrow unit status/price writer, aggregate summary RPC, admin owner-replacement RPC.
9. `..._09_storage_policies.sql` — bucket creation + storage policies.
10. `..._10_email_stream.sql` — `development_notifications` stream registration only.

Each includes an `updated_at` trigger and a rollback note. Snapshot (`npm run db:snapshot`) refreshed after apply.

---

## 8. Explicit non-couplings verified in this design
- No column, FK, view, trigger, RPC, or policy references `listings`, `hot_sheets`, `hot_sheet_*`, `favorites`, `listing_shares`, `showing_requests`, `seller_matches`, DCMLS publish flags, or membership/billing tables.
- Engagement uses its own tables; nothing writes to listing stats or Hot Sheet delivery tables.
- Shared infrastructure touched: `email_jobs` (new stream), `agent_settings` (read-only eligibility), `user_roles`/`has_role` (admin check), `profiles` (read-only agent snapshot), `auth.users` (membership FK only).

## 9. Deferred to Phase 2 (explicitly not in this migration set)
- `development_account_invites` and any invited-membership state.
- Buyer registration and any buyer PII.
- Logged-out public marketing surface and its SECURITY DEFINER reader.
- `development_document_access` and other analytics/event tracking.
