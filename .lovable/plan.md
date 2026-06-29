# Buyer Deletion Audit & Hardening Plan

## What I found

### Canonical path (good)
`src/lib/removeBuyer.ts` → invokes `remove-buyer` edge function. Used by:
- `MyClients.tsx` (agent removes buyer from CRM)
- `RemoveBuyerClientAction.tsx` (agent buyer-row + buyer account header)
- `AdminConsumers.tsx` (admin scope)
- `ClientDashboard.tsx` and `ClientAgentSettings.tsx` (buyer self-delete)

### Bypass / partial-purge paths (the problem)
1. **`DuplicateContactDialog.tsx:123`** — calls `agent_end_client_relationship` RPC directly when re-adding a duplicate. Only ends the relationship; leaves `clients`, `profiles`, and `auth.users` intact. This is the most likely source of "ghost" buyers like `tuite.alexandra16@gmail.com`.
2. **`revoke-buyer-auth` edge function** — predecessor of `remove-buyer`. No live callers in `src/`, but still deployed and callable. Keeping it around is a footgun.
3. **`delete-users` edge function** — used by `DeleteAgentDialog` / `BulkDeleteAgentsDialog` for agent deletion. Appropriate for agents, but its existence makes it easy to "accidentally" point a buyer flow at it (which is what I just had to do for the cleanup because `remove-buyer` itself is now blocked by a stale role — see #4).
4. **Stale `agent` role on a buyer blocks `remove-buyer`** — root cause for Alexandra. `remove-buyer` has a safety gate: if `user_roles` contains `agent` or `admin`, it skips `auth.users` deletion. She had an orphan `agent` row in `user_roles`, so every agent-side delete silently left the auth user behind. The gate is correct in principle, but there is no path to repair a buyer whose roles got corrupted.

### Symptom mapping
| Symptom | Cause |
|---|---|
| `auth.users` row survives delete | role-protection gate (#4) silently no-ops, or caller used `agent_end_client_relationship` directly (#1) |
| `clients` CRM row survives | only `remove-buyer` deletes it; RPC-only paths (#1) skip it |
| User signs up again → "account already exists" | surviving `auth.users` row |

## Fixes

### 1. Make `remove-buyer` the only buyer-delete door
- Replace the direct `agent_end_client_relationship` call in `DuplicateContactDialog.tsx` with `removeBuyer({ scope: "agent", crmClientId })`. The duplicate-re-add flow should fully purge the stale ghost, not just end the relationship.
- Add an ESLint-style comment guard on `agent_end_client_relationship` so future code searches discourage direct UI use.

### 2. Retire `revoke-buyer-auth`
- Delete `supabase/functions/revoke-buyer-auth/` (no callers).
- Keep `delete-users` (agent-only) but rename internal references to make scope obvious; it must never be used for buyer rows.

### 3. Repair the role-protection gate so it self-heals
Update `remove-buyer` so that, for **admin scope** or **buyer-self scope**:
- If the only "protected" role is `agent` and the user has no `agent_settings`, no `agent_profiles`, and no published `listings`, treat them as a buyer with a stale role: delete `user_roles` rows and proceed with auth purge.
- For agent-scope callers, keep the gate strict (an agent should not delete another agent).
- Log every gate skip to `audit_logs` so future ghosts are visible.

### 4. Post-delete verification + retry
Inside `remove-buyer`, after `auth.admin.deleteUser`, re-query `auth.users`, `profiles`, `clients`, `user_roles`. If any row remains, run a final targeted DELETE and return `verified: true|false` so the UI can surface failure instead of showing a false success toast.

### 5. One-time backfill
Run a sweep that finds any `clients` / `profiles` rows whose email also appears in `deleted_users` but where `auth.users` still exists, and either purges them or flags them in an admin "ghost users" view.

## Technical details

- Files to change:
  - `src/components/hot-sheets/DuplicateContactDialog.tsx` — swap RPC for `removeBuyer({ scope: "agent" })`.
  - `supabase/functions/remove-buyer/index.ts` — self-healing role gate, post-delete verify, audit log.
  - `supabase/functions/revoke-buyer-auth/` — delete.
  - `supabase/config.toml` — remove `[functions.revoke-buyer-auth]` block.
- New migration: none required; uses existing `audit_logs` and `user_roles`.
- Tests: add a `supabase--curl_edge_functions` smoke run that creates a throwaway buyer, gives them a stray `agent` role, removes via admin scope, and asserts 0 rows across all four identity tables.

## Out of scope
- Agent deletion flow (`delete-users`) — separate audit if you want it.
- `deleted_users` audit table semantics — keep as-is, just ensure every purge writes one row.

Approve and I'll implement steps 1–4 in one pass, then run the verification harness.
