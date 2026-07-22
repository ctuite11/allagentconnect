# Bulk delete confirmation + performance fix

## Are they gone?

Yes — verified against the database just now:

- `agent_profiles` rows for AAC-0130, -0127, -0125, -0120, -0117, -0115, -0113 → **0 rows**
- `agent_early_access` rows for Bridget Fortunate, Jaclyn LeClair, abby Reid, Christie Xie, Matthew Foley, Andrew DaSilva, Stephen Higdon → **0 rows**
- `auth_user_deletion_queue`: all 23 rows show `status = completed` (last update 03:21 UTC). No pending/abandoned entries.

All seven agents are fully purged from profiles, early-access, and auth.

## Why the confirm toast takes ~30s

`BulkDeleteAgentsDialog.handleBulkDelete` processes agents **strictly one at a time** with an `await` loop. For each real agent it runs, sequentially:

1. `enqueueVerifiedInactiveAgentRemovalEmail` (edge function)
2. `SELECT` from `agent_profiles`
3. `INSERT` into `deleted_users`
4. `admin_delete_agent` RPC
5. `delete-users` edge function

That's ~5 round trips × 7 agents ≈ 35 sequential network calls before the toast fires. Cold-starting the two edge functions on the first couple of agents adds another few seconds. 30s is expected under the current code.

## Fix

Refactor `src/components/admin/BulkDeleteAgentsDialog.tsx` so the batch completes in one or two round trips instead of ~35.

Approach:

1. **Parallelize the per-agent DB prep** with `Promise.allSettled` over all agents:
   - fetch profiles (single `.in('id', ids)` query instead of N `.single()` calls)
   - insert archive rows (single bulk `insert([...])`)
   - fire `enqueueVerifiedInactiveAgentRemovalEmail` for all agents in parallel (non-blocking, best-effort as today)
   - call `admin_delete_agent` per agent in parallel (RPC is per-id; `Promise.allSettled` is fine — it already handles its own transaction)
   - call `admin_delete_early_access` per early-access agent in parallel

2. **Collapse auth cleanup into a single `delete-users` invocation** for the whole batch:
   - Pass `{ userIds: [...canonicalAuthIds], emails: [...allEmails] }` once
   - Read per-target `results[]` from the response to compute `fullCount` / `partialCount` / `partialEmails`
   - The edge function already handles per-target success/failure and queue drain, so one call replaces N.

3. **Progress bar**: switch from "n/agents" step counter to a two-phase indicator (prep → auth cleanup) since work is no longer strictly serial. Keep the existing toast copy.

4. **No behavior change** to what gets deleted, safety checks, archiving, or the outbox retry path — only the ordering/batching of the calls the browser makes.

## Files to edit

- `src/components/admin/BulkDeleteAgentsDialog.tsx` — refactor `handleBulkDelete` as above.

No schema, RPC, or edge-function changes required. Single-agent `DeleteAgentDialog` stays as-is (already fast enough for one row).

## Expected result

A 7-agent bulk delete should complete in roughly 2–4 seconds instead of ~30, with the same guarantees and the same toast messaging.
