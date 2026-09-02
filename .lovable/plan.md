# Reconcile Agent Network count with Admin "Activated"

## What the numbers actually are (verified by query)

Admin page (matches your screen): Verified 47, Invited 138, Activated 284.
Agent Network currently returns **267** profiles.

The 17-agent gap breaks down exactly:

| Reason an activated agent is missing from the Network | Count |
|---|---|
| Signed in, status `verified`, but no `account_activated_at` stamp | 14 |
| Signed in, but status is not `verified` (pending/invited) | 2 |
| Verified + activated but `hide_from_directory = true` | 1 |

284 - 14 - 2 - 1 = 267.

Root cause: the two surfaces use different definitions of "activated".
Admin now derives Activated from a real `auth.users.last_sign_in_at` (the
lifecycle fix we shipped). The Network RPC `get_verified_agent_ids()` still
requires the older `agent_settings.account_activated_at` stamp. The 14 agents
signed in before sign-in-time stamping existed, so they have a real sign-in but
no stamp, and the directory silently drops them.

No agent is missing for a name, profile, or buyer-alerts reason — those filters
currently exclude nobody.

## Changes

1. **Backfill (migration, data only):** for `agent_settings` rows where the user
   has a non-null `last_sign_in_at` and `account_activated_at` is null, set
   `account_activated_at = last_sign_in_at`. Affects the 14 rows above. Nothing
   else is touched — no status, verification, password, or email change.

2. **Harden `get_verified_agent_ids()`:** treat an agent as activated when
   `account_activated_at IS NOT NULL` **OR** `auth.users.last_sign_in_at IS NOT
   NULL`, so the directory can never drift from the admin definition again. All
   other conditions (verified status, agent role, profile row, non-blank name,
   `hide_from_directory = false`) stay exactly as they are.

3. **No UI changes.** `AgentSearch.tsx` and the admin page keep their current
   behavior; the counts converge because the underlying rule converges.

## Expected result

Agent Network goes from 267 to **281**. The remaining 3 of the 284 stay out on
purpose: 2 accounts whose status is not `verified`, and 1 agent who has opted
out of the directory. I will report the before/after counts and name those 3
after the migration runs.
