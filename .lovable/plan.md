## Audit findings

Two "Jas-like" agents exist in the database:

| Agent | created_at | verified_at | account_activated_at |
|---|---|---|---|
| **Jason Manganello** | 2026-07-13 | 2026-07-13 | 2026-07-13 |
| **Jas Bhogal** | 2026-07-11 | 2026-07-11 | **2026-07-18 (today)** |

Jas Bhogal was created and verified on Jul 11, but only **activated his account today (Jul 18)**. Jason Manganello was created, verified, and activated on Jul 13.

### Why Jas is not first
- **Success Hub "Newest Verified Agents" slider** (`get_newest_verified_agents` RPC): ordered by `verified_at DESC, created_at DESC`. By that rule, Jason (Jul 13) correctly ranks above Jas (Jul 11).
- **Admin agent search** (`admin-list-agents/index.ts`): ordered by `agent_profiles.created_at DESC`. Same result — Jason ranks above Jas.

Both surfaces are behaving as coded. The mismatch is that the user's mental model of "newest" is **"most recently became a real, usable agent on the platform"** — which for Jas is his activation today — but both surfaces sort by profile/verification age instead.

## Proposed fix

Redefine "newest" as the most recent of `account_activated_at`, `verified_at`, and `created_at` — i.e. the moment the agent last crossed into a usable state. This keeps day-of-activation late-verifiers like Jas at the top of "Newest" without disrupting stable ordering for everyone else.

### 1. Success Hub slider — RPC change
New migration replacing `public.get_newest_verified_agents`:
- Same eligibility filters (verified, role=agent, not hidden, first/last name present, activated OR has company).
- `ORDER BY GREATEST(COALESCE(s.account_activated_at, 'epoch'), COALESCE(s.verified_at, 'epoch'), ap.created_at) DESC`.
- Tie-break on `s.verified_at DESC NULLS LAST, ap.created_at DESC`.

Result: Jas ranks first (his activation is today), then Jason (Jul 13).

### 2. Admin agent list — default sort
Update `supabase/functions/admin-list-agents/index.ts` primary agent query to order by:
```
GREATEST(coalesce(agent_settings.account_activated_at, epoch),
         coalesce(agent_settings.verified_at,          epoch),
         agent_profiles.created_at) DESC
```
Applied via a SQL view or by fetching `agent_settings` alongside profiles and sorting server-side (already joined on the admin list). Keep secondary tie-break on `created_at DESC`.

The pending/rejected buckets keep their existing `created_at DESC` ordering (activation is not meaningful there).

### 3. Verification
- Re-check the RPC with a direct SELECT — expect Jas first, Jason second.
- Reload Success Hub → Jas is left-most tile in the slider.
- Reload Admin → Agents tab → Jas is first row (no search filter).

## Out of scope
No changes to eligibility rules, no changes to the Agent Network / `/our-agents` sorting (that page has its own Recommended/Random logic).