# New Developments MVP — Backend Design Review Package (Revision 6)
Status: PROPOSAL ONLY. Nothing applied. No migrations run, no buckets created, no functions deployed, no RLS changed, no secrets set.

Revision 6 closes the seven backend-authority/security items raised against Revision 5 (see §13): submission is Edge Function / service-role only for leads and showing requests (no raw client INSERT); developer lead/showing UPDATE is column-limited to `status` and `assigned_contact_id`; `development_accounts` system fields are protected and `developments.account_id` is immutable (no re-parenting), with `is_active=false` given real enforcement meaning; the incorrect account-delete/cascade-trigger statement is removed in favor of no hard account deletion; saves and shares gain an explicit `development_id → developments(id)` FK; invisible Turnstile plus per-user rate limiting are restored on both submission Edge Functions; and notification idempotency is keyed on stable identities (`sales_contact_id` / `owner_user_id`) with `notified_at` meaning *all* intended jobs were enqueued.

Revision 5 closed the six items raised against Revision 4 (see §12): restored `developments.logo_url` plus the flexible `building_details` and free-text `hoa_fees` fields; `development_units.estimated_delivery` back to `date`; the full frozen media storage contract (`storage_bucket`, `mime_type`, `duration_seconds`, `caption`); `NOT NULL` + `auth.users` FK invariants on every engagement actor id; the composite-FK paragraph corrected to exclude saves/shares; and the initial-owner hole closed with an atomic account-creation RPC plus explicit `development_accounts` RLS.

Revision 4 closed the six items raised against Revision 3: the `tier` typo (`premier` → `premium`), removal of the unapproved `agent_faq` document category, three drifted field decisions (`half_baths` removed, unit `status` defaults to `coming_soon`, `estimated_completion` is a `date`), the controlled sales-contact `role` vocabulary with nullable email/phone, dual-path signed-document authorization (eligible agent + published **or** accepted account member at any publish status), and two integrity/security tightenings (immutable membership `account_id`/`user_id`; composite `(development_id, account_id)` FKs on every child table carrying `account_id`). The `admin_notes` grants contradiction is also resolved with one concrete mechanism.

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
| Logged-out public marketing | **Out of scope.** `public_marketing` remains a forward-looking document flag only: it grants **no anonymous access**, but such documents are fully readable/downloadable by eligible agents on a published development. No public SECURITY DEFINER surface in MVP. |
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
development_accounts(
  id pk,
  name text not null,
  legal_name text,
  slug text unique not null,
  billing_email text,
  stripe_customer_id text,          -- reserved for future billing; unused in MVP
  is_active boolean not null default true,
  created_at, updated_at
)

development_account_members(
  id pk,
  account_id  fk->development_accounts on delete cascade,
  user_id     uuid not null references auth.users(id) on delete restrict,
  role        text not null check (role in ('owner','editor','sales','viewer')),
  invited_by  uuid,
  accepted_at timestamptz not null default now(),
  created_at, updated_at,
  unique(account_id, user_id)
)
```
- Frozen account fields restored: `legal_name`, `billing_email`, forward-looking `stripe_customer_id`, `is_active` (replacing the ad-hoc `status`/`contact_email` pair). `stripe_customer_id` is a column only — no billing logic, no Stripe coupling in MVP.
- `accepted_at` restored on membership. Because MVP has accepted members only, it defaults to `now()` at insert; Phase 2 invites will set it at acceptance time.
- **No `invite_status`.** A row in this table means an accepted member. There is no invited/revoked membership state; revocation is a delete.
- **Pending invites are Phase 2** in a separate `development_account_invites` table, not built in MVP.
- `user_id` keeps its FK to `auth.users` with `on delete restrict` so membership rows cannot be orphaned.
- **`account_id` and `user_id` are immutable after insert.** A `before update` trigger raises if either changes. Membership transfer is delete + create, so every transfer necessarily passes the last-owner invariant instead of sidestepping it by re-parenting an `owner` row to another account.

```sql
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
```
This trigger runs before the last-owner trigger (alphabetical firing order is pinned by naming), so an attempted re-parent fails outright.

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

**Initial-owner hole closed — account creation is atomic.** The last-owner trigger can only protect an owner that already exists, so a bare `INSERT` into `development_accounts` would leave an account with zero owners. MVP therefore has **no direct insert path** for accounts: `authenticated` gets no `INSERT` grant on `development_accounts`, and creation goes through one `security definer` RPC that writes both rows in a single transaction.

```sql
create or replace function public.create_development_account(
  _name text, _slug text, _owner_user_id uuid,
  _legal_name text default null, _billing_email text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
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
```
Both inserts commit or neither does, so an account never exists — even momentarily within another transaction's visible state — without an `owner`.

**Correction: there is no hard account deletion in MVP.** Revision 5 claimed that deleting an account cascades member deletion "without consulting" the last-owner trigger. That is wrong: PostgreSQL executes FK cascade deletes as ordinary deletes on the referencing table, and **row triggers on that table fire** — the last-owner trigger would raise and the delete would fail. Rather than invent a deletion-only bypass, MVP removes the case entirely:
- `DELETE` on `development_accounts` is granted to **no one** (`authenticated` has no DELETE grant, no DELETE policy exists), and a `before delete` trigger raises unconditionally, matching the permanence rule already applied to `developments`.
- Disabling an account is `is_active = false`. Developments are permanent/archived already, so nothing needs hard removal.
- If a true purge is ever required, it becomes a deliberate, admin-only, service-role maintenance procedure designed at that time — not an implicit cascade.

**`is_active = false` has enforced meaning** (it is not a decorative flag):
- Members and admins may still **read** the account and its developments — recovery and billing history remain visible.
- All **member writes are blocked** across the account: every member-write policy on `development_accounts`, `developments`, and every child table adds `and public.is_development_account_active(<account_id>)`. Owners cannot edit, submit for review, add inventory/media/documents, or update leads/showings while disabled.
- Its developments are **not agent-visible**: the eligible-agent read policies add the same predicate, so a disabled account's published developments disappear from the agent surface without any `publish_status` change.
- Lead/showing submission Edge Functions reject a disabled account (400/403) before insert.
- Only admins/`service_role` may flip `is_active` back to true.

```sql
create or replace function public.is_development_account_active(_account_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.development_accounts a
                     where a.id = _account_id and a.is_active) $$;
```

**`development_accounts` RLS — explicit:**
```sql
alter table public.development_accounts enable row level security;

-- no anon grant, no anon policy anywhere on this table
-- system fields (is_active, stripe_customer_id) are NOT owner-writable:
grant select on public.development_accounts to authenticated;            -- no INSERT, no DELETE
grant update (name, legal_name, billing_email, slug, updated_at)
  on public.development_accounts to authenticated;                       -- column-limited UPDATE
grant all on public.development_accounts to service_role;

create policy "Members read their own account"
on public.development_accounts for select to authenticated
using (public.is_development_member(id) or public.has_role(auth.uid(), 'admin'));

create policy "Owners edit their own organization details"
on public.development_accounts for update to authenticated
using (
  (public.is_development_member(id, array['owner']) and is_active)
  or public.has_role(auth.uid(), 'admin')
)
with check (
  (public.is_development_member(id, array['owner']) and is_active)
  or public.has_role(auth.uid(), 'admin')
);
```
- **Read:** any accepted member of the account (`owner|editor|sales|viewer`) plus admins.
- **Write:** `owner` role and admins only, **and only the columns `name`, `legal_name`, `billing_email`, `slug`** (plus system `updated_at`). `slug` changes follow the same permanence rules as development slugs.
- **AAC-controlled system fields:** `is_active` and `stripe_customer_id` are outside the `authenticated` UPDATE grant entirely — they are changed by admins through a `security definer` RPC (`admin_set_development_account_active`) or `service_role` only. RLS restricts rows, not columns, so the column-level grant is the enforcement mechanism; a paired `before update` trigger also raises if either field changes with a non-admin, non-`service_role` `current_request_role()`, as defense in depth.
- **Create:** admins, via `create_development_account` only. **Delete:** nobody — no grant, no policy, and a `before delete` trigger. Soft-disable via `is_active` is the only removal path in MVP.
- **Anonymous:** no grant and no policy — unreachable, consistent with the agents-only MVP.

**Admin recovery without a bypass flag:** `admin_replace_development_owner(_account_id uuid, _new_owner_user_id uuid)` is `security definer`, asserts `has_role(auth.uid(),'admin')`, and **promotes/inserts the replacement owner first**. Once a second owner exists, demoting the prior owner satisfies the invariant naturally. `current_setting('aac.admin_owner_recovery')` is removed entirely — a caller-settable GUC is not an authorization boundary.

### 2.2 Developments (permanent id, two independent status fields)

```
developments(
  id uuid pk default gen_random_uuid(),      -- permanent, never reused
  account_id fk->development_accounts on delete restrict,
  name text not null,
  slug text unique not null,
  slug_locked_at timestamptz,                -- set on first publish
  logo_url text,                             -- development-branded mini-site logo
  lifecycle_status text not null default 'coming_soon'
    check (lifecycle_status in ('coming_soon','pre_construction','under_construction','now_selling','completed')),
  publish_status text not null default 'draft'
    check (publish_status in ('draft','pending_review','published','paused','archived')),
  published_at timestamptz, published_by uuid,   -- admin only, first publish stamp
  submitted_at timestamptz, paused_at timestamptz, archived_at timestamptz,

  -- location
  address, city, state, postal_code, latitude, longitude,
  neighborhood text, neighborhood_description text,

  -- project team + timeline
  developer_name text, architect_name text, interior_designer_name text,
  estimated_completion date,                 -- MVP: a date, not free text
  delivery_from date, delivery_to date,

  -- building details
  total_units int, total_buildings int, stories int, year_built int,
  construction_type text,
  building_details jsonb not null default '{}',  -- frozen flexible bucket for project-specific specs
  amenities jsonb not null default '[]',
  parking_description text, parking_included boolean,
  pet_policy text,
  hoa_fees text,                                 -- frozen free-text HOA description ("$612/mo, incl. heat")
  hoa_fee_min numeric(12,2), hoa_fee_max numeric(12,2), hoa_fee_includes text,

  -- commercial terms
  deposit_structure text,
  incentives text,
  buyer_agent_compensation text,
  buyer_agent_compensation_notes text,

  -- marketing + admin
  description text, highlights jsonb not null default '[]',
  tier text not null default 'standard' check (tier in ('standard','featured','premium')),
  admin_notes text,                          -- admin-only column (see RLS note below)
  created_by uuid, updated_by uuid,
  created_at, updated_at,
  unique(id, account_id)                     -- composite FK target
)
```
- **`logo_url`, `building_details`, and `hoa_fees` are restored from the frozen foundation.** `logo_url` is required by the development-branded mini-site. The structured fields added in Revision 4 (`total_units`/`stories`/`construction_type`, `hoa_fee_min`/`hoa_fee_max`/`hoa_fee_includes`) remain as **additions**, not replacements: `building_details` is the flexible jsonb bucket for anything not modeled as a column, and `hoa_fees` is the free-text display string. When both are present, structured columns drive filtering/sorting and the free-text/jsonb values drive display; neither is derived from the other and neither is required.
- Full frozen project field set restored: developer/architect/designer, estimated completion, building details, amenities, parking, pets, HOA, deposit structure, incentives, buyer-agent compensation, neighborhood info, tier, lifecycle timestamps (`submitted_at` / `paused_at` / `archived_at`), `admin_notes`, and `created_by` / `updated_by` audit fields.
- `admin_notes` is never exposed to agents or members. **One concrete mechanism (chosen):** the base table `public.developments` receives **explicit column-level grants** — `GRANT SELECT (col, col, …) ON public.developments TO authenticated` listing every column *except* `admin_notes` — and **no table-level `GRANT SELECT`**. `GRANT INSERT/UPDATE` is likewise column-scoped to exclude `admin_notes`, `published_at`, `published_by`, and `slug_locked_at`. Admins and `service_role` read/write the full row (`GRANT ALL … TO service_role`; admin reads go through a `security definer` RPC). See §3 for the corrected grant wording — no unrestricted base-table SELECT is granted anywhere that a column restriction is claimed.
- `estimated_completion` stays a `date` for MVP as approved. If delivery *ranges* are needed later, that is a deliberate extension (the existing `delivery_from` / `delivery_to` date pair already covers ranged messaging).
- `submitted_at` is stamped when a member moves `draft → pending_review`; `paused_at` / `archived_at` are stamped by the admin transition trigger.
- `lifecycle_status` and `publish_status` are **independent**. Nothing collapses them; a `completed` development can be `paused`, a `now_selling` one can be `draft`.
- **Slug locking:** a `before update` trigger sets `slug_locked_at = now()` on the first transition to `published`, and rejects any `slug` change once `slug_locked_at is not null` (admins included, to preserve link permanence).
- **Admin publication — explicit transition matrix.** A `before update` trigger enforces the *complete* matrix, not just transitions touching `published`, so a member cannot reach an admin-only state through direct SQL/API access:

```
Actor   | Allowed publish_status transitions
--------+--------------------------------------------------------------
member  | draft -> pending_review
        | pending_review -> draft
        | (no other transition, in any direction, from any state)
admin   | draft|pending_review -> published
        | published -> paused | archived
        | paused -> published | archived
        | archived -> draft | published
        | pending_review -> draft | archived
```
Anything not in the matrix raises. Explicitly blocked for members: `draft -> paused`, `draft -> published`, `draft -> archived`, `pending_review -> paused`, `pending_review -> published`, `pending_review -> archived`, and every transition out of `published` / `paused` / `archived`. The trigger stamps `published_at`/`published_by` on first publish only, `submitted_at` on `draft -> pending_review`, `paused_at` on entry to `paused`, and `archived_at` on entry to `archived`.
- **Permanence:** account→developments is `on delete restrict`; archival is a `publish_status` change. `development_id_registry(id pk, created_at)` (insert-only) plus a `before delete` trigger blocking hard deletes guarantees ids are never reused.
- **`account_id` is immutable after insert — no re-parenting.** Revision 5 described "no re-parenting path in MVP" while still listing `account_id` in the authenticated UPDATE column grant. Corrected two ways: `account_id` is **removed from the `UPDATE` column grant** (it stays in the `SELECT` and `INSERT` lists), and a `before update` trigger raises on any change:

```sql
create or replace function public.enforce_immutable_development_account()
returns trigger language plpgsql as $$
begin
  if new.account_id is distinct from old.account_id then
    raise exception 'developments.account_id is immutable; a development cannot be re-parented';
  end if;
  return new;
end $$;

create trigger trg_development_account_immutable
before update on public.developments
for each row execute function public.enforce_immutable_development_account();
```
  This also makes the `(development_id, account_id)` composite FKs on child tables unconditionally stable: the parent key can never move, so `on update cascade` is dead code kept only as a safety net.

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
  description text,
  beds numeric(4,1), baths numeric(4,1),      -- no separate half_baths; halves ride in baths
  sqft_min int, sqft_max int,
  price_min numeric(12,2), price_max numeric(12,2),
  features jsonb not null default '[]',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at, updated_at,
  unique(id, development_id),
  unique(development_id, name),
  check (sqft_min is null or sqft_max is null or sqft_min <= sqft_max),
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
  status text not null default 'coming_soon'
    check (status in ('available','reserved','under_agreement','sold','coming_soon')),
  description text,
  views_exposure text,                         -- e.g. "south-facing, harbor view"
  parking_spaces int, parking_notes text,
  outdoor_space text,
  incentives text,
  estimated_delivery date,                     -- frozen type: a date, not free text
  is_featured boolean not null default false,
  sort_order int not null default 0,
  status_changed_at timestamptz,
  price_changed_at timestamptz,
  created_at, updated_at,
  unique(id, development_id),
  unique(development_id, building_phase_id, unit_number)   -- Building A/2A ≠ Building B/2A
)
```
- Floor plans restored to the frozen shape: `sqft_min`/`sqft_max` (not a single `sqft`), plus `description`, `features`, `is_active`, `sort_order`.
- Units restored to the approved daily-inventory/product shape: `description`, `views_exposure`, parking, `incentives`, `estimated_delivery`, `is_featured`, `sort_order`, and the `status_changed_at` / `price_changed_at` stamps. A `before update` trigger sets `status_changed_at` when `status` changes and `price_changed_at` when `price` changes (including a change to `NULL`), so the narrow sales writer needs no special-casing.
- **`estimated_delivery` is a `date`**, per the frozen unit schema. Quarter-style messaging ("Q2 2027") is a presentation concern derived from the date; there is no free-text delivery column on units.
- **No `held` status.** The frozen five-value vocabulary stands.
- **No `half_baths` column** on floor plans or units. `beds` / `baths` are `numeric(4,1)`; a 2.5-bath plan is `baths = 2.5`.
- **Unit `status` defaults to `coming_soon`**, matching the approved foundation — a newly created unit is not implicitly for sale.
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
    check (kind in ('construction','sales','design','general')),
  title text not null,
  body_markdown text not null,                 -- Markdown only; raw HTML rejected by trigger
  posted_at timestamptz not null default now(),
  is_published boolean not null default false,
  published_at timestamptz,                    -- stamped on first publish, never rewritten
  is_pinned boolean not null default false,
  created_by uuid, updated_by uuid, created_at, updated_at,
  unique(id, development_id)
)
```
- **Frozen update vocabulary restored:** exactly `construction | sales | design | general`. `milestone`, `pricing`, and `event` are removed.
- `updated_by` restored alongside `created_by`.
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
  storage_bucket text, storage_path text,             -- both set for source_type='storage'
  external_url text,
  is_hero boolean not null default false,             -- development-level hero SSOT
  width int, height int, alt text, caption text,
  mime_type text, duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  sort_order int not null default 0,
  created_by, created_at, updated_at,
  check (
    (floor_plan_id is not null)::int
  + (unit_id is not null)::int
  + (update_id is not null)::int <= 1                 -- 0 = development-level media
  ),
  check (
    (source_type = 'storage' and storage_bucket is not null and storage_path is not null
       and external_url is null)
 or (source_type = 'external' and external_url is not null
       and storage_bucket is null and storage_path is null)
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
- `unique(development_id, storage_bucket, storage_path)` where `storage_path is not null`.
- **Full frozen storage contract restored.** Storage-backed media records `storage_bucket` **and** `storage_path` so the object is addressable without hard-coding a bucket name in application code; external media leaves both null. `mime_type`, `duration_seconds` (video/tour length), and `caption` are restored as approved metadata — `alt` stays accessibility text, `caption` is displayed copy.

```
development_documents(
  id pk, development_id, account_id,
  title text not null,
  description text,
  category text not null check (category in (
    -- marketing / project
    'brochure',
    'floor_plan',
    'site_plan',
    'spec_sheet',
    'finish_package',
    'disclosure',
    'condo_docs',
    'deposit_schedule',
    -- For Agents (six)
    'broker_registration',
    'buyer_agent_compensation',
    'commission_bonus',
    'showing_tour_procedure',
    'sales_office_hours',
    'offer_submission',
    'other'
  )),
  access text not null default 'agent_only' check (access in ('agent_only','public_marketing')),
  is_featured_agent_resource boolean not null default false,
  floor_plan_id uuid,                          -- optional floor-plan attachment
  unit_id uuid,                                -- optional unit attachment
  storage_path text not null, byte_size bigint, mime_type text,
  sort_order int not null default 0,
  created_by, created_at, updated_at,
  unique(development_id, storage_path),
  check ((floor_plan_id is not null)::int + (unit_id is not null)::int <= 1),
  foreign key (floor_plan_id, development_id)
    references public.development_floor_plans(id, development_id) on delete set null,
  foreign key (unit_id, development_id)
    references public.development_units(id, development_id) on delete set null
)
```
- **Frozen category set, now exact.** The invented names `floor_plan_pdf`, `price_sheet`, `hoa_condo_docs`, `offering_plan`, and `agent_faq` are all removed. The set is the eight marketing/project categories (`brochure`, `floor_plan`, `site_plan`, `spec_sheet`, `finish_package`, `disclosure`, `condo_docs`, `deposit_schedule`), the **six** named For Agents categories (`broker_registration`, `buyer_agent_compensation`, `commission_bonus`, `showing_tour_procedure`, `sales_office_hours`, `offer_submission`), plus `other`.
- **Optional unit attachment restored**, using the same composite-FK parent-consistency model as floor plans; a document may attach to at most one parent (floor plan *or* unit) and otherwise sits at development level.
- `description` and `is_featured_agent_resource` restored — the latter drives the "For Agents" highlight rail.
- `public_marketing` is stored and **is readable/downloadable by eligible agents** on a published development. It simply grants no anonymous access in MVP (see §3 and §4).

### 2.6 Sales contacts (routing SSOT)

```
development_sales_contacts(
  id pk, development_id, account_id,
  name text not null,
  email text,                                                 -- nullable: a displayed contact may be phone-only
  phone text,                                                 -- nullable
  title text,
  role text not null default 'sales_associate'
    check (role in ('sales_director','sales_associate','onsite_concierge','marketing','other')),
  headshot_url text,
  bio text,
  user_id uuid references auth.users(id) on delete set null,  -- optional; contacts need not be AAC users
  is_active boolean not null default true,
  is_primary boolean not null default false,
  receives_leads boolean not null default true,
  receives_showing_requests boolean not null default true,
  sort_order int not null default 0,
  created_at, updated_at,
  unique(id, development_id),
  check (email is not null or phone is not null)              -- a contact must be reachable somehow
)
```
- `role` is a controlled vocabulary (`sales_director | sales_associate | onsite_concierge | marketing | other`), default `sales_associate` — not free text. Display labels live in the frontend.
- `email` and `phone` are both nullable (an on-site concierge may be phone-only), with a check that at least one is present. Email uniqueness becomes a **partial** index: `create unique index ... on development_sales_contacts(development_id, lower(email)) where email is not null;`
- One primary per development: `create unique index ... on development_sales_contacts(development_id) where is_primary and is_active;`

**Routing rule (server-side only) — three ordered tiers:**
1. Active contacts flagged for the channel (`receives_leads` / `receives_showing_requests`) **that have a non-null email**.
2. If empty → the **primary active contact** (`is_primary and is_active`) if it has an email, regardless of channel flag.
3. If still empty → the account's `owner` members.

**Email-less contacts never block routing.** A contact without an email is displayed on the mini-site but is skipped by every routing tier; resolution simply continues down the fallback chain, so a phone-only sales team still results in owner notification.

Account membership role is never itself a routing signal; it is only the last-resort safety net.

### 2.7 Engagement (agent actions, persist-before-notify)

```
development_saves(id pk,
  development_id uuid not null references public.developments(id) on delete cascade,
  agent_user_id uuid not null references auth.users(id) on delete cascade,
  created_at,
  unique(development_id, agent_user_id))

development_shares(id pk,
  development_id uuid not null references public.developments(id) on delete cascade,
  unit_id null,
  agent_user_id uuid not null references auth.users(id) on delete cascade,
  share_type text not null check (share_type in
    ('copy_link','email','facebook','x','linkedin','whatsapp','other')),
  created_at,
  foreign key (unit_id, development_id) references public.development_units(id, development_id) on delete set null)

development_leads(
  id pk, development_id, account_id, unit_id null,
  agent_user_id uuid not null references auth.users(id) on delete restrict,  -- authoritative, from JWT
  sender_name text not null,                   -- server-snapshotted from the agent profile
  sender_email text not null,
  sender_phone text,
  message text,
  source text not null check (source in ('development_page','unit_page','share')),
  status text not null default 'new'
    check (status in ('new','contacted','closed','spam')),
  assigned_contact_id uuid,                    -- human assignment only; never routing
  notified_at timestamptz, created_at, updated_at,
  foreign key (unit_id, development_id) references public.development_units(id, development_id) on delete set null,
  foreign key (assigned_contact_id, development_id)
    references public.development_sales_contacts(id, development_id) on delete set null)

development_showing_requests(
  id pk, development_id, account_id, unit_id null,
  agent_user_id uuid not null references auth.users(id) on delete restrict,
  requester_name text not null,                -- server-snapshotted
  requester_email text not null,
  requester_phone text,
  preferred_date date,
  preferred_time text,                         -- intentionally loose: "afternoon", "after 5"
  message text,
  status text not null default 'pending'
    check (status in ('pending','confirmed','completed','cancelled','declined')),
  assigned_contact_id uuid,
  notified_at timestamptz, created_at, updated_at,
  foreign key (unit_id, development_id) references public.development_units(id, development_id) on delete set null,
  foreign key (assigned_contact_id, development_id)
    references public.development_sales_contacts(id, development_id) on delete set null)
```
- **Frozen engagement vocabularies restored.** Shares: `copy_link | email | facebook | x | linkedin | whatsapp | other` (no `sms`, no generic `social`). Lead source: `development_page | unit_page | share`. Lead status: `new | contacted | closed | spam` — the unapproved CRM states (`qualified`, `tour_scheduled`, `registered`, `archived`) are removed. The showings table is `development_showing_requests` with `pending | confirmed | completed | cancelled | declined`.
- **No buyer fields.** Buyer registration is not MVP; leads and showings are AAC-agent actions. Name/email/phone are the *agent's*, snapshotted server-side at insert so later profile edits don't rewrite history.
- **Saves and shares carry an explicit parent FK.** They correctly have no `account_id` and no composite FK, but `development_id` is `NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE`, so a save or share can never reference a nonexistent development. (Hard development deletes are blocked by the permanence trigger; the cascade only matters for a deliberate admin/service purge.)
- **Rows are created by the server only.** `development_leads` and `development_showing_requests` have **no `INSERT` grant for `authenticated`** — see §3. Inserts happen exclusively inside the submission Edge Functions under `service_role`, which is what makes the `sender_*` / `requester_*` snapshot, the notification path, Turnstile, and rate limiting non-optional rather than merely conventional.
- **Actor identity is a database invariant, not just a server convention.** `agent_user_id` is `NOT NULL REFERENCES auth.users(id)` on saves, shares, leads, and showing requests. Delete behavior differs by table: saves and shares are ephemeral engagement and use `on delete cascade` (the row disappears with the account); leads and showing requests are business records and use `on delete restrict` so a developer's pipeline cannot be silently erased — the server-snapshotted `sender_*` / `requester_*` fields preserve the contact details regardless.
- `agent_user_id` always comes from the verified JWT, never the request body; the FK/NOT NULL pair means a forged or missing actor cannot be persisted even if a caller bypasses the Edge Function.
- `notified_at` means **every intended notification job for that row was successfully enqueued**, not merely that one recipient was queued. The row commits first; if any recipient enqueue fails, `notified_at` stays `null` so the row is retriable and visible as un-notified (§6).

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

- `is_development_account_active(_account_id uuid)` — the `is_active` gate (§2.1)

**Grants — one mechanism, no contradictions.** For every development table *except* `developments`, `development_accounts`, `development_leads`, and `development_showing_requests`, grants are table-level: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated; GRANT ALL ON public.<table> TO service_role;` (those tables have no restricted columns). The four exceptions are column- or verb-restricted and are spelled out below and in §2.1.

**Leads and showing requests — no raw client INSERT, column-limited UPDATE.**

Submission is **Edge Function / service-role only**. Table-level INSERT for `authenticated` would let an agent write arbitrary `sender_name/email/phone`, skip the server snapshot, bypass Turnstile/rate limiting, and never trigger the notification path — so the privilege simply does not exist:
```sql
-- development_leads (development_showing_requests is identical in shape)
GRANT SELECT ON public.development_leads TO authenticated;          -- no INSERT, no DELETE
GRANT UPDATE (status, assigned_contact_id, updated_at)
  ON public.development_leads TO authenticated;                     -- developer triage only
GRANT ALL ON public.development_leads TO service_role;              -- the only writer of new rows
```
- **INSERT:** `service_role` only, from `development-lead-submit` / `development-showing-request` after JWT verification, eligibility, publish, account-active, Turnstile, and rate-limit checks. No INSERT policy for `authenticated` is created at all (a policy without a grant would be misleading).
- **Agent read-back:** agents may `SELECT` their **own** submitted rows (`agent_user_id = auth.uid() and public.current_is_eligible_agent()`), which is what the "my submissions" UI needs. Nothing else.
- **Developer UPDATE is column-limited to `status` and `assigned_contact_id`** (plus system `updated_at`). RLS chooses *rows*, not *columns*, so the column grant is the real boundary: `owner|editor|sales` cannot rewrite `agent_user_id`, the `sender_*`/`requester_*` snapshots, `message`, `development_id`, `unit_id`, `account_id`, `created_at`, or `notified_at`. `notified_at` is `service_role`-only in every direction.
- A `before update` trigger additionally raises if any non-triage column changes under a non-`service_role` request (`public.current_request_role()`), as defense in depth against a future grant mistake.
- `assigned_contact_id` remains constrained by its composite FK to `development_sales_contacts(id, development_id)`, so triage cannot point a lead at another development's contact.
- `viewer` gets `SELECT` only; the update policy requires `is_development_member(account_id, array['owner','editor','sales'])` **and** `is_development_account_active(account_id)`.

For `public.developments`, which does have a restricted column, there is **no table-level `SELECT`/`INSERT`/`UPDATE` grant to `authenticated`**. Instead:
```sql
-- explicit safe-column grants; admin_notes deliberately absent
GRANT SELECT (id, account_id, name, slug, slug_locked_at, lifecycle_status, publish_status,
              published_at, submitted_at, paused_at, archived_at, address, city, state,
              postal_code, latitude, longitude, neighborhood, neighborhood_description, logo_url,
              developer_name, architect_name, interior_designer_name, estimated_completion,
              delivery_from, delivery_to, total_units, total_buildings, stories, year_built,
              construction_type, building_details, amenities, parking_description,
              parking_included, pet_policy, hoa_fees, hoa_fee_min, hoa_fee_max,
              hoa_fee_includes, deposit_structure, incentives,
              buyer_agent_compensation, buyer_agent_compensation_notes, description,
              highlights, tier, created_at, updated_at)
  ON public.developments TO authenticated;
GRANT INSERT (…same safe list, minus published_at/published_by/slug_locked_at…),
      UPDATE (…same safe list, minus published_at/published_by/slug_locked_at,
              and minus account_id — developments are never re-parented…),
      DELETE ON public.developments TO authenticated;   -- DELETE still blocked by the permanence trigger
GRANT ALL ON public.developments TO service_role;
```
Admin access to `admin_notes` is via `service_role` / a `security definer` admin RPC, never a broadened base grant. **No `anon` grant on any development table** — agents-only MVP.

Policy matrix:

| Table | Eligible agents | owner / editor | sales | viewer | Admin |
|---|---|---|---|---|---|
| developments | SELECT where `publish_status='published'` | CRUD on own account, except `publish_status='published'`, `published_*`, locked `slug` | read | read | all |
| buildings_phases / floor_plans | SELECT where parent published | CRUD | read | read | all |
| units | SELECT where parent published | **CRUD** | **read + narrow status/price RPC only** | read | all |
| updates | SELECT where parent published and `is_published` | CRUD | read | read | all |
| media | SELECT where parent published | CRUD | read | read | all |
| documents | SELECT where parent published, **both** `access` values (bytes via signed URL) | CRUD | read | read | all |
| sales_contacts | **SELECT where parent published and `is_active`** (mini-site sales team, phone/email CTAs) | CRUD | read | read | all |
| saves / shares | insert/select/delete own rows only | **no row access** (aggregate RPC) | no row access | no row access | all |
| leads / showing_requests | **no INSERT** (Edge Function / service-role only); SELECT own submitted rows | select own account's rows; UPDATE **`status` + `assigned_contact_id` only** | select; UPDATE **`status` + `assigned_contact_id` only** | read | all |
| account_members | — | select own account; owners manage | select own account | select own account | all |
| accounts | — | read; owners UPDATE **`name`/`legal_name`/`billing_email`/`slug` only** | read | read | all (incl. `is_active`, `stripe_customer_id`) |

Every member-write policy in this matrix additionally requires `public.is_development_account_active(account_id)`, and every eligible-agent read policy requires it too, so a disabled account is read-only for its members and invisible to agents (§2.1).

- **No broad sales UPDATE on units.** Sales-role members have `SELECT` only; all sales-side mutation goes through the narrow RPC in §5.
- Full AAC agent contact details on leads/showings are visible to owner/editor/sales (decision 2).
- Publication guard: a `WITH CHECK` clause plus trigger blocks members from writing `publish_status='published'`, `published_at`, `published_by`, or a locked `slug`.
- **`public_marketing` is not a restriction on agents.** Both `agent_only` and `public_marketing` documents are readable by eligible agents on a published development; the flag only marks material that *may later* be shown publicly. `anon` still has no grant and no policy on any development table, so nothing is anonymously reachable in MVP.
- Agent/member SELECT on `developments` excludes `admin_notes` purely through the column grants above — there is no compensating table-level SELECT grant that would defeat them.

**Denormalized `account_id` on child tables — mandatory composite FK.** Every child table that carries `account_id` alongside `development_id` (phases, floor plans, units, updates, media, documents, sales contacts, leads, showing requests) declares:
```sql
alter table public.<child>
  add constraint <child>_development_account_fk
  foreign key (development_id, account_id)
  references public.developments(id, account_id) on update cascade on delete cascade;
```
**Saves and shares are deliberately excluded.** They carry `development_id` and `agent_user_id` only — no `account_id` — matching the frozen schema; there is nothing to keep in agreement, so no redundant column and no composite FK is added for them. They still resolve their account through `development_account_id(development_id)` when the aggregate RPC needs it.

This makes it structurally impossible for a child row's `account_id` to disagree with its development's owning account, closing the cross-account authorization gap the denormalization would otherwise create. `developments.unique(id, account_id)` is the FK target. Because `developments.account_id` is effectively immutable (`on delete restrict` to the account; no re-parenting path in MVP), the cascade is a safety net, not a routine path.

Agent read policies all take the form:
```sql
create policy "Eligible agents read published developments"
on public.developments for select to authenticated
using (
  publish_status = 'published'
  and public.is_development_account_active(account_id)
  and public.current_is_eligible_agent()
);
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
- SELECT on `development-documents`: **no direct client select.** Access is only via a **5-minute** signed URL minted by an Edge Function, one document per call, for eligible agents on a published development — for **both** `agent_only` and `public_marketing` documents. Anonymous callers are rejected. No access-logging table in MVP.

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

**Narrow writer** — the only path by which a sales member changes inventory. Two corrections vs Revision 2: the return shape is narrow (not the whole unit row), and "leave unchanged" is distinguishable from "clear the price back to TBD" via an explicit `_clear_price` flag:
```sql
create type public.development_unit_write_result as (
  unit_id uuid,
  status text,
  price numeric,
  status_changed_at timestamptz,
  price_changed_at timestamptz,
  updated_at timestamptz
);

create or replace function public.set_development_unit_status_price(
  _unit_id uuid,
  _status  text default null,
  _price   numeric default null,
  _clear_price boolean default false
) returns public.development_unit_write_result
language plpgsql volatile security definer set search_path = public as $$
declare
  v_unit public.development_units;
  v_out  public.development_unit_write_result;
begin
  if _clear_price and _price is not null then
    raise exception 'Pass either _price or _clear_price, not both';
  end if;

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
         price  = case when _clear_price then null
                       when _price is not null then _price
                       else price end,
         updated_at = now()
   where id = _unit_id
  returning id, status, price, status_changed_at, price_changed_at, updated_at
       into v_out;

  return v_out;
end $$;
revoke all on function public.set_development_unit_status_price(uuid, text, numeric, boolean)
  from public, anon;
grant execute on function public.set_development_unit_status_price(uuid, text, numeric, boolean)
  to authenticated;
```
Only `status` and `price` are mutable through this path — no unit number, phase, floor plan, or dimension changes — and the caller never receives columns it isn't entitled to mutate. `status_changed_at` / `price_changed_at` are stamped by the unit trigger, so a deliberate clear-to-TBD is recorded as a real price change.

---

## 6. Edge Function architecture (design only) — three functions

All follow the same shape: `npm:@supabase/supabase-js@2`, CORS, JWT validated in code (`verify_jwt=false` + explicit `getUser`), Zod validation, service-role client used only after authorization, persist-before-notify.

**Abuse controls on both submission functions (restored from the frozen handoff).** `development-lead-submit` and `development-showing-request` are the only write path into leads/showings, so both carry, in this order, before any insert:
1. **Invisible Cloudflare Turnstile**, using the pattern already in this repo — client obtains a token via `src/hooks/useTurnstile.ts` (managed/invisible widget, `src/components/security/TurnstileField.tsx` where a visible slot is needed); the function verifies it with the existing `supabase/functions/_shared/verifyTurnstile.ts` helper and returns the shared generic 403 `TURNSTILE_GENERIC_ERROR` on failure. No new secret is introduced — `TURNSTILE_SECRET_KEY` already exists.
2. **Per-user rate limiting** via the existing `public.rate_limit_consume(p_key, p_window_seconds, p_limit)` RPC used by `send-contact-email`, keyed on the authenticated user (not just IP): `route:development-lead-submit|user:{auth_uid}` and `route:development-showing-request|user:{auth_uid}`, with a secondary IP key as a backstop. Proposed limits: **5 per 10 minutes and 20 per 24 hours per user, per development**. Exceeded → `429` with `Retry-After`, no row inserted, no email enqueued.

1. **`development-lead-submit`** — validate body (Zod) → verify Turnstile → rate-limit → resolve `agent_user_id` from the JWT (never the body) → assert eligible agent → assert development `published` **and** its account `is_active` → snapshot `sender_name/email/phone` from the agent profile server-side → insert `development_leads` (service-role; no client INSERT path exists) → resolve recipients through the three-tier routing order (flagged active contacts → **primary active contact** → account `owner` members) → enqueue one `email_jobs` row per resolved recipient → stamp `notified_at` only after **all** enqueues succeed.
2. **`development-showing-request`** — identical flow against `development_showing_requests` (`preferred_date`, `preferred_time` text, `message`), with the same Turnstile + per-user rate limiting, tier 1 filtered by `receives_showing_requests`, then the same primary-contact and owner fallbacks.

**Notification idempotency uses stable identities, not email addresses.** An email address can change between retries, which would duplicate a notification. Keys are:
- sales-contact recipient → `dev-lead:{lead_id}:contact:{sales_contact_id}` / `dev-showing:{showing_request_id}:contact:{sales_contact_id}`
- owner-fallback recipient → `dev-lead:{lead_id}:owner:{owner_user_id}` / `dev-showing:{showing_request_id}:owner:{owner_user_id}`

Resolved email addresses are **deduplicated case-insensitively before enqueue**, so one person holding two roles receives one email; the surviving job keeps the highest-precedence identity key (contact over owner). `notified_at` is stamped in a single update **after every intended job is confirmed enqueued** — a partial failure leaves `notified_at` null so the submission is visibly un-notified and safely retriable (the identity keys make a retry idempotent).
3. **`development-document-url`** — authorize via **two valid paths**, then mint a 5-minute signed URL and return the URL only. No logging table.
   - **Path A:** eligible AAC agent (verified + activated) **and** the development is `published` — any `access` value.
   - **Path B:** an accepted member of that development's account (`owner | editor | sales | viewer`) — **regardless of publish status**, so developers can preview and download their own documents while `draft` / `pending_review` / `paused` / `archived`.
   - Admins are authorized on either path.
   - Anonymous callers are always rejected. TTL stays 5 minutes.

**`development-member-invite` is removed.** Invites are Phase 2; MVP has no invited-membership state to create.

Emails reuse the existing `email_jobs` queue with a new dedicated stream (`development_notifications`) so Hot Sheet / Comms Center streams and pauses stay untouched. **No existing template file or shared builder is modified**; a new builder file is added for this stream only.

---

## 7. Migration sequence (proposed file names, not applied)

1. `..._new_developments_01_accounts_members.sql` — accounts (frozen fields incl. `legal_name`, `billing_email`, `stripe_customer_id`, `is_active`), members (accepted-only, 4 roles, `accepted_at`), concurrency-safe last-owner trigger, atomic `create_development_account` RPC (no direct account INSERT grant), explicit `development_accounts` grants + RLS.
2. `..._02_developments_core.sql` — developments with the full frozen field set (incl. `logo_url`, `building_details`, `hoa_fees`), `lifecycle_status` + `publish_status`, id registry, permanence / **full transition-matrix** / slug-lock triggers, `admin_notes` column restriction.
3. `..._03_inventory.sql` — buildings_phases (auto **Main**), floor_plans (`sqft_min/max`, features, active, sort), units (full product fields + `status_changed_at` / `price_changed_at` trigger), composite FKs with `on delete restrict` on phase.
4. `..._04_updates.sql` — development_updates (`construction|sales|design|general`, `updated_by`), pinned-unique index, Markdown guard, first-publish stamp.
5. `..._05_media_documents.sql` — media (XOR ownership, `storage_bucket` + `storage_path` / external, `mime_type`, `duration_seconds`, `caption`, hero unique) and documents (frozen category set, optional floor-plan **or** unit attachment, `is_featured_agent_resource`).
6. `..._06_sales_contacts.sql` — sales contacts (controlled `role` vocabulary, nullable email/phone with reachability check, headshot, bio, `is_primary` + partial unique indexes), routing indexes, agent read policy for published developments.
7. `..._07_engagement.sql` — saves, shares (frozen share types, with `unit_id`), leads (frozen source/status), `development_showing_requests`; `agent_user_id NOT NULL REFERENCES auth.users(id)` on all four (cascade on saves/shares, restrict on leads/showings); no `account_id` on saves/shares.
8. `..._08_helpers_rpcs.sql` — eligibility/membership helpers and grants, sales inventory reader, narrow unit status/price writer (narrow return type + `_clear_price`), aggregate summary RPC, admin owner-replacement RPC.
9. `..._09_storage_policies.sql` — bucket creation + storage policies.
10. `..._10_email_stream.sql` — `development_notifications` stream registration only.

Each includes an `updated_at` trigger, the `(development_id, account_id)` composite FK for any table carrying `account_id`, and a rollback note. Snapshot (`npm run db:snapshot`) refreshed after apply.

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

---

## 10. Revision 3 change log (against Revision 2)

| # | Correction |
|---|---|
| 1 | Restored frozen `development_accounts` fields (`legal_name`, `billing_email`, `stripe_customer_id`, `is_active`), `accepted_at` on members, and the full frozen `developments` field set (developer/architect, estimated completion, building details, amenities, parking, pets, HOA, deposit structure, incentives, buyer-agent compensation, neighborhood, tier, submitted/paused/archived stamps, admin notes, created/updated-by). |
| 2 | Restored floor plans to `sqft_min/sqft_max` + description/features/active/sort, and units to the approved product field set incl. `status_changed_at` / `price_changed_at`. |
| 3 | Update kinds reset to `construction | sales | design | general`; `updated_by` restored. |
| 4 | Document categories reset to the exact frozen set; optional unit attachment, `description`, and `is_featured_agent_resource` restored; unit parent consistency uses the same composite-FK model as floor plans. |
| 5 | Sales contacts regained `role`, headshot, bio, `is_primary`; routing is now three-tier with the primary-contact fallback; eligible agents can read active contacts on published developments. |
| 6 | Engagement vocabularies reset: share types, lead source, lead status, and `development_showing_requests` with `pending|confirmed|completed|cancelled|declined`. |
| 7 | `public_marketing` documents are readable and signable for eligible agents; anon remains forbidden. |
| 8 | Publish guard now enforces the complete transition matrix, blocking member paths like `draft → paused` and `pending_review → archived`. |
| 9 | Narrow sales writer returns a narrow composite type and distinguishes "leave unchanged" from "clear price to TBD" via `_clear_price`. |

## 11. Revision 4 change log (against Revision 3)

| # | Correction |
|---|---|
| 1 | `developments.tier` vocabulary corrected: `premier` → **`premium`** (`standard | featured | premium`). |
| 2 | Removed the never-approved `agent_faq` document category; the For Agents set is the **six** named categories, and the "restored exactly" claim is now accurate. |
| 3 | Field decisions restored: `half_baths` removed (beds/baths `numeric(4,1)` only), `development_units.status` defaults to **`coming_soon`**, and `estimated_completion` is a **`date`** again rather than free text. |
| 4 | `development_sales_contacts.role` is a controlled set (`sales_director | sales_associate | onsite_concierge | marketing | other`, default `sales_associate`); `email` and `phone` are nullable with an at-least-one-reachable check, email uniqueness is a partial index, and email-less contacts are skipped by routing rather than blocking it. |
| 5 | `development-document-url` now authorizes two paths — eligible agent + published, **or** accepted account member at any publish status (admins on either) — preserving the 5-minute TTL and pre-publication developer preview. |
| 6 | Integrity/security: membership `account_id` and `user_id` are immutable after insert (transfer = delete/create, so the owner invariant cannot be bypassed by re-parenting), and every child table carrying `account_id` gets a composite `(development_id, account_id) → developments(id, account_id)` FK. |
| 7 | Grants contradiction resolved: `public.developments` gets **explicit safe-column grants only** — no table-level `SELECT` to `authenticated` — so the `admin_notes` column restriction actually holds. |

## 12. Revision 5 change log (against Revision 4)

| # | Correction |
|---|---|
| 1 | Restored three foundation fields on `developments`: `logo_url` (required by the development-branded mini-site), flexible `building_details jsonb`, and free-text `hoa_fees`. Revision 4's structured building/HOA columns stay as additions, not replacements; all three are added to the safe-column grants. |
| 2 | `development_units.estimated_delivery` reverted from `text` to **`date`**, per the frozen unit schema. |
| 3 | Media storage contract completed: `storage_bucket` restored alongside `storage_path` (both required for `source_type='storage'`, both null for external), plus the approved `mime_type`, `duration_seconds`, and `caption` metadata; the uniqueness index now covers `(development_id, storage_bucket, storage_path)`. |
| 4 | Engagement actor ids are now database invariants: `agent_user_id uuid NOT NULL REFERENCES auth.users(id)` on saves, shares, leads, and showing requests — `on delete cascade` for saves/shares, `on delete restrict` for leads/showing requests. Server-side JWT identity resolution remains authoritative. |
| 5 | Composite-FK contradiction fixed: saves and shares are removed from the `(development_id, account_id)` sentence and gain no redundant `account_id`; leads, showing requests, and the denormalized content/inventory tables keep the composite protection. |
| 6 | Initial-owner hole closed: no direct `INSERT` grant on `development_accounts`; creation goes through an atomic `security definer` `create_development_account` RPC that writes the account and its first `owner` in one transaction. `development_accounts` RLS spelled out — members read, owner/admin manage, admin-only create/delete, no anonymous access. |
