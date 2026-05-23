# Block removed buyers from logging in

## Problem

When an agent removes a buyer, `agent_end_client_relationship` clears the relationship, hot sheets, and invite tokens — but the buyer's `auth.users` account is untouched. She can still sign in at `/consumer/auth` (and on DCMLS once it launches) using her existing password, even though she has no active relationship.

## Goal

After removal, the buyer should not be able to log in anywhere as a buyer. Re-adding her must require a fresh invite + password setup (which already works on the data side).

## Approach

Add a server-side step to the buyer-removal flow that revokes the buyer's auth credential when they have no remaining active/pending agent relationships and are not themselves an agent/admin.

### 1. New edge function: `revoke-buyer-auth`

- Verifies the caller is an authenticated agent.
- Takes `buyer_client_id` (the `clients.id`).
- Looks up the buyer's email from `clients`, then resolves the matching `auth.users` row by email.
- Safety gates — only proceed if ALL true:
  - User has no role of `agent` or `admin` in `user_roles`.
  - User has zero rows in `client_agent_relationships` with `status IN ('active','pending')` and `ended_at IS NULL` (across any agent).
  - User has zero rows in `hot_sheet_clients` joined to existing `hot_sheets`.
- Action: delete the buyer's auth user via `supabase.auth.admin.deleteUser(userId)`. Reuse the FK-blocker clearing pattern from `delete-users/index.ts` so cleanup is safe (profiles, favorites, buyer_qualifications, buyer_credentials, notification_preferences, conversation_participants, hot_sheet_comments, share_tokens.accepted_by_user_id → null, etc.).
- If safety gates fail (buyer still tied to another agent, or is also an agent), do nothing and return `{ skipped: true, reason }`. We never silently lock out a multi-agent buyer.

Deletion (vs ban) is the right call here because:
- The existing removal flow already wipes hot sheets, comments, favorites, relationships.
- Re-adding the buyer creates a brand-new invite + password setup, so a stale auth row only causes confusion.
- It matches the user's stated intent: "no lingering history."

### 2. Wire into removal flow

In `src/components/success-hub/RemoveBuyerClientAction.tsx → removeBuyerClient`, after the existing `agent_end_client_relationship` RPC succeeds, call `supabase.functions.invoke('revoke-buyer-auth', { body: { buyer_client_id } })`. Treat any error as non-fatal (toast warning, log) — the relationship removal already succeeded and is the source of truth.

### 3. Backfill the current case

One-off: revoke the auth login for the buyer who is currently in the broken state (e.g., `n.lopachak@gmail.com`) after verifying the safety gates above pass for her. Done via the same edge function path so the logic is exercised end-to-end.

## Out of scope

- No UI changes.
- No change to the existing `agent_end_client_relationship` SQL — auth.users mutations don't belong in a SECURITY DEFINER SQL function.
- No change to invite/accept flows; they already work once the auth row is gone.
- DCMLS-side login UI is unchanged — it will share the same `auth.users` table, so removing the row blocks both apps.

## Verification

1. As agent, remove a buyer who is only your client → buyer's auth row is gone; `/consumer/auth` login fails with "invalid credentials".
2. Re-add the buyer → fresh invite email, Create Password page works, buyer can log in again.
3. Remove a buyer who is also active with another agent → auth row preserved, edge function returns `skipped`.
4. Remove a buyer who is also an agent/admin → auth row preserved.
