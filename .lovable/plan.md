
# Team Accounts

Extends the existing `teams` / `team_members` tables and pages (`/team/:id`, `/manage-team`) into the full Team Accounts feature described in the spec. Legacy data is preserved; new columns and rules are additive.

## 1. Schema changes (single migration)

**`teams`** — add:
- `slug text unique` (auto-generated from name, editable)
- `bio text` (rename usage of existing `description` for the public bio; keep column, alias in UI)
- `company text` (brokerage/company)
- `status text default 'pending'` — check in `('pending','approved','rejected','suspended')`
- `team_lead_user_id uuid` references `auth.users(id)` — required
- `approved_by uuid` references `auth.users(id)`
- `approved_at timestamptz`
- `rejection_reason text`

Backfill: existing rows → `status='approved'`, `team_lead_user_id = created_by`, generated slug.

**`team_members`** — add:
- `status text default 'invited'` — check in `('invited','accepted','declined','removed')`
- `invited_by uuid`
- `invited_at timestamptz default now()`
- `accepted_at timestamptz`
- `updated_at timestamptz`
- Extend role check to `('lead','delegate','member')`; migrate old `'owner'` → `'lead'`.

Backfill: existing rows → `status='accepted'`, `accepted_at = joined_at`.

**Constraints:**
- Partial unique index: one `accepted` row per `agent_id` across all teams (enforces "one accepted team at a time").
- Existing `(team_id, agent_id)` unique constraint stays.
- Trigger: exactly one `role='lead'` per team when `status='accepted'`.

**Security-definer helpers** (avoid RLS recursion):
- `is_team_lead(team_id, user_id)`
- `is_team_delegate(team_id, user_id)` — accepted delegate
- `is_team_manager(team_id, user_id)` — lead OR accepted delegate OR admin
- Replace existing `is_team_owner` usages with `is_team_manager`.

**RLS rewrite:**
- `teams` SELECT: public sees `status='approved'`; managers and admins see all their teams; requester sees own pending.
- `teams` INSERT: authenticated verified agent, `created_by=auth.uid()`, `status='pending'`.
- `teams` UPDATE: `is_team_manager` (non-status fields); admins for status; leads can transfer only via admin action (out of scope for direct edit).
- `teams` DELETE: admin only (leads can request suspension, not delete).
- `team_members` SELECT: public sees rows where team approved AND `status='accepted'`; managers see all rows on their teams; the invited agent sees their own rows.
- `team_members` INSERT: managers, forced `status='invited'`.
- `team_members` UPDATE: managers for role/order/removal; the invited agent for their own accept/decline transitions.
- `team_members` DELETE: managers; blocked for `role='lead'` unless replaced first.

Grants: `SELECT` to anon+authenticated (RLS narrows); `INSERT/UPDATE/DELETE` to authenticated; `ALL` to service_role.

## 2. Routes

- `/team/request` — Create a Team Account form (verified agents only). Replaces "New Team" flow.
- `/team/:slug` — public Team Profile. Keep `/team/:id` as legacy alias that resolves and 301s in-app to slug.
- `/team/:id/manage` — internal manage page (replaces `/manage-team` UUID-scoped). Old `/manage-team` route redirects.
- `/team/invite/:token` — invited agent accepts/declines.
- `/admin/team-approvals` — admin queue.

## 3. UI

**Request form (`/team/request`)** — new page:
- Team name, slug preview, brokerage/company, team logo, team photo, bio, website, social links
- Requesting-user role radio: Team Lead / Authorized Delegate
- If Delegate: AgentAutocomplete to pick the Team Lead + confirmation checkbox "I am authorized to manage on their behalf"
- On submit: insert `teams` (`status='pending'`, `team_lead_user_id`, `created_by=me`); insert `team_members` rows for lead (`status='invited'`) and, if delegate, delegate (`status='accepted'` for the requester); notify admins.

**Agent account area** — add "Create a Team Account" entry (Agent Settings / Success Hub) that links to `/team/request`. If the user is already a manager of an approved team, link to that team's manage page instead.

**Team Profile (`/team/:slug`)** — extend existing `TeamProfile.tsx`:
- Fetch by slug; 404 unless `status='approved'` (or viewer is manager/admin — show preview banner).
- Members grid: only `status='accepted'`; headshot, name, title, company; each card links to individual agent public profile.
- Combined Team Listings: query `listings` where `agent_id IN (accepted member ids)` and existing searchable-status/visibility filters; use existing listing-card components; each card links to normal property detail; keeps original agent attribution.
- Contact info, website, social, bio, company, logo, team photo unchanged in layout.

**Manage Team (`/team/:id/manage`)** — extend existing `ManageTeam.tsx`:
- Access: `is_team_manager` else redirect.
- Sections:
  - Details (all editable fields; managers only, admins any)
  - Members list with drag-reorder (existing), role pills (Lead / Delegate / Member), status pills (Invited / Accepted / Declined / Removed)
  - Invite Agent: AgentAutocomplete of verified AAC agents → creates `team_members` row `status='invited'`, calls existing `send-team-invite` edge function (extended: include invite token, link to `/team/invite/:token`); blocks duplicates and blocks agents already accepted on another team.
  - "Assign Delegate" action on any accepted member (lead + admin only).
  - "Remove" action (managers). Blocked on `role='lead'` with clear message.
- Read-only view for non-managers with an accepted role.

**Invite acceptance (`/team/invite/:token`)** — new page:
- Requires auth; the invited agent's `id` must match `team_members.agent_id`.
- Accept → sets `status='accepted'`, `accepted_at=now()`. Blocks if agent already has another accepted membership (offer "leave current team" flow).
- Decline → sets `status='declined'`.

**Admin Team Approvals (`/admin/team-approvals`)** — new admin page:
- Tabs: Pending / Approved / Suspended / Rejected.
- Row shows team info, requester, declared lead, delegate (if any).
- Actions: Approve (sets `status='approved'`, `approved_by`, `approved_at`, and if lead invite is still 'invited', it stays until the lead accepts — team stays private if lead has not accepted), Reject (with reason), Suspend, Reactivate. Ownership-transfer flow is a manual admin action that reassigns `team_lead_user_id` and updates the `role='lead'` member row.

## 4. Invite email
- Extend `send-team-invite` to include `inviteToken` and a link to `/team/invite/:token`. Queue via `email_jobs`, `AAC Unified` template.

## 5. Behavioral rules enforced

- Only verified agents can submit a request. Team private until admin approval AND lead accepts.
- Members appear publicly only when `status='accepted'`.
- Removing a member removes them from the team profile; their listings and profile are untouched.
- Listings section is a live query — no denormalized ownership.
- Lead cannot be removed by delegate; admin-only ownership transfer.
- One accepted team per agent enforced by partial unique index + application check with clear error.

## 6. Files touched / added

Migration:
- `supabase/migrations/<ts>_team_accounts.sql`

New:
- `src/pages/TeamRequest.tsx`
- `src/pages/TeamInviteAccept.tsx`
- `src/pages/AdminTeamApprovals.tsx`
- `src/hooks/useTeamAccess.ts` (manager/admin/member checks)
- `src/lib/teams/slug.ts`

Edited:
- `src/pages/TeamProfile.tsx` — slug lookup, approved-only public view, listings query with accepted members, member link to individual profile.
- `src/pages/ManageTeam.tsx` — new roles, statuses, invite-with-token, delegate assignment, one-team enforcement, admin-preview mode.
- `src/App.tsx` — new routes + legacy redirects.
- `src/pages/AgentSettings.tsx` (or Success Hub entry) — "Create a Team Account" link.
- `supabase/functions/send-team-invite/index.ts` — accept token + include acceptance URL.
- Admin navigation — add "Team Approvals" entry.

## 7. Out of scope (unchanged from spec)
Shared billing, commission splits, lead routing, shared CRM, team inbox, brokerage hierarchy, auto ownership transfer, custom permissions.

## 8. Verification checklist
Matches the spec's verification list one-for-one; will be validated via manual walk-through and Playwright screenshots of `/team/request`, `/team/:slug`, `/team/:id/manage`, `/team/invite/:token`, `/admin/team-approvals` at the end.
