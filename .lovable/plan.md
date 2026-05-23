# Delete Buyer Auth on Removal

When an agent removes a buyer client, delete the buyer's Cloud auth user so they can no longer log in to AAC (or DCMLS later). The only way back in is a fresh invite from an agent, which creates a new auth account via the existing create-password flow.

## Behavior

- Agent removes buyer → CRM contact stays (history preserved) → buyer's `auth.users` row is deleted → buyer's session is invalidated → `/consumer/auth` login fails.
- Agent re-invites the same email → fresh share token → buyer creates a new password → new auth user → can log in again.
- If the same email is also a client of another agent (multi-agent buyer), auth is preserved so the other relationship still works. (This safety gate already exists.)
- Agents and admins are never auth-deleted via this path.

## What's already wired

- Edge function `supabase/functions/revoke-buyer-auth/index.ts` exists and contains:
  - Caller agent verification
  - Email lookup from `clients` → match in `auth.users`
  - Safety gates (skip if user has agent/admin role, has other active/pending `client_agent_relationships`, or has authored `hot_sheet_comments`)
  - FK cleanup (favorites, qualifications, credentials, notification prefs, conversation participants; nullifies `share_tokens.accepted_by_user_id`, `listing_status_history.changed_by`)
  - `auth.admin.deleteUser()` call
- `RemoveBuyerClientAction.tsx` already invokes `revoke-buyer-auth` after `agent_end_client_relationship` (non-fatal on failure).

## Steps

1. **Deploy** `revoke-buyer-auth` so the wired call actually executes in production.
2. **Refine safety gate**: drop the `hot_sheet_comments` author check — historical comments shouldn't block deletion. Replace with: nullify/preserve comment `sender_id` references via FK cleanup so deletion succeeds while comments remain.
3. **Backfill the current orphan**: delete `n.lopachak@gmail.com`'s auth user (and any equivalent buyer-role auth users with zero active/pending relationships) by invoking the deployed function or an equivalent one-shot admin call.
4. **Verify**:
   - Remove a single-agent buyer → `auth.users` row gone; login attempt at `/consumer/auth` returns invalid credentials; existing session is revoked.
   - Re-invite same email → create-password flow succeeds → new auth user → login works.
   - Multi-agent buyer removed by one agent → auth preserved (function returns `skipped`).
   - Agent or admin accidentally targeted → auth preserved.

## Out of scope

- No UI changes to the removal confirmation dialog.
- No changes to `agent_end_client_relationship` SQL (auth mutations stay in the edge function).
- No changes to invite/accept flow.
- No DCMLS-side changes (shared `auth.users` automatically gates DCMLS once it launches).

## Technical notes

- Backfill is a one-shot admin operation, not a migration (touches `auth.users`).
- Edge function continues to return `{ success, deleted_user_id }` or `{ skipped, reason }`; client logs but does not block removal on failure.
