# Fix: Admin Approvals shows 379 agents as "Pending"

## What actually happened

No agent status changed. The database still holds 384 verified, 7 pending, 3 invited.

The admin agent list function loads all agent profiles (379 of them), then makes a
single request for their settings rows using one giant URL containing every agent ID.
That URL has now grown past the transport limit, so the request fails outright:

```text
[admin-list-agents] Settings fetched: 0
[admin-list-agents] Settings error: TypeError: error sending request ...
[admin-list-agents] Status distribution: { unknown: 379 }
```

The function swallows that error and continues with empty settings, so every agent
loses its verified/activated stamps and the page's fallback rule labels them "Pending".
This crossed the breaking point as the roster grew — hence the sudden flip.

## The fix

1. **Batch the settings lookup.** Split the agent-ID list into chunks (200 per request)
   and merge the results, so the request size no longer scales with the roster.
2. **Stop failing silently.** If any settings chunk errors, the function returns an
   error instead of returning agents with unknown statuses. A load failure should show
   as a load failure, never as 379 fake Pending agents.
3. **Apply the same batching to any other ID-list lookups in the same function**
   (reminder log, email status, license upload joins) that use the full agent-ID list,
   so they can't hit the same wall next.
4. Redeploy the function and confirm the Admin Approvals counters return to the real
   distribution (roughly 261 activated, ~120 verified, 7 pending, 3 invited).

## Notes

- Backend only. No status writes, no emails, no schema changes.
- Nothing to repair in the data — statuses were never modified.

## Technical detail

File: `supabase/functions/admin-list-agents/index.ts`. Replace the single
`.in('user_id', userIds)` settings query with a chunked loop, propagate chunk errors as
a 500, and audit the other `.in(...)` calls in the same handler for the same pattern.
