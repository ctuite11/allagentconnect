## Plan (revised to match actual infrastructure)

Confirmed by reading `send-team-request-notification/index.ts`: there is no `send-transactional-email` function. The real contract is a direct insert into `email_jobs`:

```
payload: {
  provider: "resend",
  template: "<template-key>",
  to: "<recipient>",
  subject: "<explicit subject>",
  variables: { contentHtml: "<html>" },
  idempotency_key: "<key>",
}
```

Subject is set on the payload (not returned by `renderEmailTemplate.ts`), which matches your note. The renderer isn't in the path for these HTML-embed emails.

### 1. New edge function: `send-team-decision-email`

Mirrors `send-team-request-notification`. Server-side:

- Input: `{ teamId: string, decision: "approved" | "rejected", rejectionReason?: string }`. Admin-only — verify caller via JWT + `has_role('admin')`.
- Uses service role client to:
  1. Load the team row (`name`, `slug`, `id`, `team_lead_user_id`, `created_by`, `logo_url`).
  2. **Resolve recipient server-side**: try `agent_profiles.email` for `team_lead_user_id`, then for `created_by`, then `auth.admin.getUserById(team_lead_user_id).email`, then `created_by`. Bail with a clear error if none.
  3. Build HTML with `buildAacEmail` (`_shared/aacEmailTemplate.ts`) — same visual system as the rest of AAC email.
  4. Insert into `email_jobs`:
     - **Approved**
       - `subject`: `Your team account "${teamName}" is approved`
       - CTAs: primary `Manage your team` → `${APP_ORIGIN}/team/${teamId}/manage`; secondary `View public team profile` → `${APP_ORIGIN}/team/${slug || teamId}`
       - `idempotency_key`: `team-approved:${teamId}`
       - `template`: `team-approved`
     - **Rejected**
       - `subject`: `Your team account request needs changes`
       - Includes `rejectionReason` (escaped) + CTA `Update your request` → `${APP_ORIGIN}/team/request`
       - `idempotency_key`: `team-rejected:${teamId}:${short-hash(rejectionReason)}` so a resubmission after edits can re-send
       - `template`: `team-rejected`
- Returns `{ success, resolvedRecipient }` so the admin toast can show who was emailed.

### 2. Wire into `AdminTeamApprovals.tsx`

In `setTeamStatus`, after a successful `teams` update to `approved` or `rejected`:

- `supabase.functions.invoke('send-team-decision-email', { body: { teamId, decision: next, rejectionReason: reason } })`
- Soft-fail:
  - Approval succeeds → success toast `Team approved · notified {resolvedRecipient}`.
  - Email enqueue error → warning toast `Approved, but notification failed: {message}` (no rollback).
- No `auth.users` reads from the browser.

### 3. Admin shortcut buttons (previous ask, still in)

Only rendered when `useAuthRole().isAdmin`:

- `src/pages/AgentProfileEditor.tsx` header — outline "Admin tools" button → `/admin/approvals`.
- `src/pages/ManageTeam.tsx` header — outline "Admin tools" button → `/admin/team-approvals`.
- Existing Settings entries left as-is.

### Deploy & verify

- Deploy `send-team-decision-email`.
- Pre-check for Josh: read `agent_profiles.email` for his `team_lead_user_id` / `created_by` so the resolved recipient is confirmed before you click Approve.
- Approve Josh's pending team → email lands with a working `/team/${teamId}/manage` CTA → verification complete.

### Not changing

- `renderEmailTemplate.ts` and its fail-closed guard (irrelevant to this HTML-embed path).
- `email_jobs` schema, `process-email-queue`, Resend config, `APP_ORIGIN` env.
