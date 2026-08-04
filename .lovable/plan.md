# Speed up the Admin Approvals page

## What is actually slow

Every visit to the admin page triggers one `admin-list-agents` call that takes roughly **6 seconds** end to end. From the live function logs of the most recent load:

```text
admin caller verified        0.3s
auth users scanned (321)     0.9s
agent_profiles (304)         1.4s
agent_settings (304)         1.9s
agent_early_access (100)     2.2s
pending_verifications +
email_jobs scan              6.5s   <- the bulk of the wait
```

Two confirmed causes:

1. **The email-status scan dominates.** The function reads `email_jobs` filtered by `payload->>'template'`. There is no index on that expression (checked: zero matching indexes), so Postgres scans the whole table, and the query selects the entire `payload` column — the table is 33 MB and 760 rows match. Both the scan and the payload transfer are wasted work; the function only uses `payload->>'to'` and `payload->>'template'`.
2. **Everything runs one after another.** The auth user scan and the five table reads are sequential `await`s even though none depends on the previous one.

On top of that, the page refetches from scratch on every mount with no cache, so going back to the admin page always pays the full cost again with a blank spinner.

## Fix

**1. Index the email-jobs lookup (migration)**
Add an index on `email_jobs ((payload->>'template'), created_at desc)` so the template filter uses an index instead of a full table scan. Index only — no rows touched, no queue writes, no emails.

**2. Stop pulling whole payloads**
In `admin-list-agents`, replace `select(... , payload)` with only the fields used: `to:payload->>to` and `template:payload->>template` alongside the status columns, and bound the read to a recent window instead of `limit(20000)`. Same output, a fraction of the bytes.

**3. Run the independent reads in parallel**
Wrap the auth user scan, `agent_profiles`, `agent_settings`, `agent_early_access`, `pending_verifications`, and the email-jobs read in a single `Promise.all`. The merge logic afterwards is unchanged; error handling per source is preserved exactly as today (including the explicit `pending_verifications` failure surface).

**4. Cache on the client**
Move the `AdminApprovals` fetch to React Query with a short `staleTime` and cached previous data, so returning to the page renders the last list immediately and refreshes in the background instead of showing a full-page spinner. The manual Refresh button and all post-action `fetchAgents()` calls keep working by invalidating the query.

Expected result: first load drops to roughly 1–1.5s, and repeat visits render instantly.

## Scope guard

No agent records edited, no activations, no purges, no setup links, no emails, no queue writes, no Comms Center or Hot Sheet changes. The only database change is one new index.
