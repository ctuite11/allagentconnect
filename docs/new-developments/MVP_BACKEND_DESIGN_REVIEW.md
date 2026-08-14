# New Developments MVP — Backend Design Review Package (Revision 4)
Status: PROPOSAL ONLY. Nothing applied. No migrations run, no buckets created, no functions deployed, no RLS changed, no secrets set.

Revision 4 closes the final six items raised against Revision 3: the `tier` typo (`premier` → `premium`), removal of the unapproved `agent_faq` document category, three drifted field decisions (`half_baths` removed, unit `status` defaults to `coming_soon`, `estimated_completion` is a `date`), the controlled sales-contact `role` vocabulary with nullable email/phone, dual-path signed-document authorization (eligible agent + published **or** accepted account member at any publish status), and two integrity/security tightenings (immutable membership `account_id`/`user_id`; composite `(development_id, account_id)` FKs on every child table carrying `account_id`). The `admin_notes` grants contradiction is also resolved with one concrete mechanism.

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
  amenities jsonb not null default '[]',
  parking_description text, parking_included boolean,
  pet_policy text,
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
  estimated_delivery text,                     -- free text: "Q2 2027"
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
development_saves(id pk, development_id, agent_user_id, created_at,
  unique(development_id, agent_user_id))

development_shares(id pk, development_id, unit_id null, agent_user_id,
  share_type text not null check (share_type in
    ('copy_link','email','facebook','x','linkedin','whatsapp','other')),
  created_at,
  foreign key (unit_id, development_id) references public.development_units(id, development_id) on delete set null)

development_leads(
  id pk, development_id, account_id, unit_id null,
  agent_user_id uuid not null,                 -- authoritative, from JWT
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
  agent_user_id uuid not null,
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

**Grants — one mechanism, no contradictions.** For every development table *except* `developments`, grants are table-level: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated; GRANT ALL ON public.<table> TO service_role;` (those tables have no restricted columns).

For `public.developments`, which does have a restricted column, there is **no table-level `SELECT`/`INSERT`/`UPDATE` grant to `authenticated`**. Instead:
```sql
-- explicit safe-column grants; admin_notes deliberately absent
GRANT SELECT (id, account_id, name, slug, slug_locked_at, lifecycle_status, publish_status,
              published_at, submitted_at, paused_at, archived_at, address, city, state,
              postal_code, latitude, longitude, neighborhood, neighborhood_description,
              developer_name, architect_name, interior_designer_name, estimated_completion,
              delivery_from, delivery_to, total_units, total_buildings, stories, year_built,
              construction_type, amenities, parking_description, parking_included, pet_policy,
              hoa_fee_min, hoa_fee_max, hoa_fee_includes, deposit_structure, incentives,
              buyer_agent_compensation, buyer_agent_compensation_notes, description,
              highlights, tier, created_at, updated_at)
  ON public.developments TO authenticated;
GRANT INSERT (…same safe list, minus published_at/published_by/slug_locked_at…),
      UPDATE (…same safe list, minus published_at/published_by/slug_locked_at…),
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
| leads / showing_requests | insert own; select own | select + update own account's rows (status, assignment) | **select + update** own account's rows | read | all |
| account_members | — | select own account; owners manage | select own account | select own account | all |

- **No broad sales UPDATE on units.** Sales-role members have `SELECT` only; all sales-side mutation goes through the narrow RPC in §5.
- Full AAC agent contact details on leads/showings are visible to owner/editor/sales (decision 2).
- Publication guard: a `WITH CHECK` clause plus trigger blocks members from writing `publish_status='published'`, `published_at`, `published_by`, or a locked `slug`.
- **`public_marketing` is not a restriction on agents.** Both `agent_only` and `public_marketing` documents are readable by eligible agents on a published development; the flag only marks material that *may later* be shown publicly. `anon` still has no grant and no policy on any development table, so nothing is anonymously reachable in MVP.
- Agent/member SELECT on `developments` excludes `admin_notes` purely through the column grants above — there is no compensating table-level SELECT grant that would defeat them.

**Denormalized `account_id` on child tables — mandatory composite FK.** Every child table that carries `account_id` alongside `development_id` (phases, floor plans, units, updates, media, documents, sales contacts, saves, shares, leads, showing requests) declares:
```sql
alter table public.<child>
  add constraint <child>_development_account_fk
  foreign key (development_id, account_id)
  references public.developments(id, account_id) on update cascade on delete cascade;
```
This makes it structurally impossible for a child row's `account_id` to disagree with its development's owning account, closing the cross-account authorization gap the denormalization would otherwise create. `developments.unique(id, account_id)` is the FK target. Because `developments.account_id` is effectively immutable (`on delete restrict` to the account; no re-parenting path in MVP), the cascade is a safety net, not a routine path.

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

1. **`development-lead-submit`** — validate body → resolve `agent_user_id` from the JWT (never the body) → assert eligible agent → assert development published → snapshot `sender_name/email/phone` from the agent profile server-side → insert `development_leads` → resolve recipients through the three-tier routing order (flagged active contacts → **primary active contact** → account `owner` members) → enqueue `email_jobs` with idempotency key `dev-lead:{lead_id}:{recipient_email}` → stamp `notified_at`.
2. **`development-showing-request`** — identical flow against `development_showing_requests` (`preferred_date`, `preferred_time` text, `message`), tier 1 filtered by `receives_showing_requests`, then the same primary-contact and owner fallbacks, key `dev-showing:{showing_request_id}:{recipient_email}`.
3. **`development-document-url`** — authorize via **two valid paths**, then mint a 5-minute signed URL and return the URL only. No logging table.
   - **Path A:** eligible AAC agent (verified + activated) **and** the development is `published` — any `access` value.
   - **Path B:** an accepted member of that development's account (`owner | editor | sales | viewer`) — **regardless of publish status**, so developers can preview and download their own documents while `draft` / `pending_review` / `paused` / `archived`.
   - Admins are authorized on either path.
   - Anonymous callers are always rejected. TTL stays 5 minutes.

**`development-member-invite` is removed.** Invites are Phase 2; MVP has no invited-membership state to create.

Emails reuse the existing `email_jobs` queue with a new dedicated stream (`development_notifications`) so Hot Sheet / Comms Center streams and pauses stay untouched. **No existing template file or shared builder is modified**; a new builder file is added for this stream only.

---

## 7. Migration sequence (proposed file names, not applied)

1. `..._new_developments_01_accounts_members.sql` — accounts (frozen fields incl. `legal_name`, `billing_email`, `stripe_customer_id`, `is_active`), members (accepted-only, 4 roles, `accepted_at`), concurrency-safe last-owner trigger, grants, RLS.
2. `..._02_developments_core.sql` — developments with the full frozen field set, `lifecycle_status` + `publish_status`, id registry, permanence / **full transition-matrix** / slug-lock triggers, `admin_notes` column restriction.
3. `..._03_inventory.sql` — buildings_phases (auto **Main**), floor_plans (`sqft_min/max`, features, active, sort), units (full product fields + `status_changed_at` / `price_changed_at` trigger), composite FKs with `on delete restrict` on phase.
4. `..._04_updates.sql` — development_updates (`construction|sales|design|general`, `updated_by`), pinned-unique index, Markdown guard, first-publish stamp.
5. `..._05_media_documents.sql` — media (XOR ownership, storage/external, hero unique) and documents (frozen category set, optional floor-plan **or** unit attachment, `is_featured_agent_resource`).
6. `..._06_sales_contacts.sql` — sales contacts (controlled `role` vocabulary, nullable email/phone with reachability check, headshot, bio, `is_primary` + partial unique indexes), routing indexes, agent read policy for published developments.
7. `..._07_engagement.sql` — saves, shares (frozen share types, with `unit_id`), leads (frozen source/status), `development_showing_requests`.
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
