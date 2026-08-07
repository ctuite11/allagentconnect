# Fix Comms Center coverage matching — placeholder ZIPs suppress valid recipients

## Safety rules (binding)

- The six Aug 4–7 Communications broadcasts are **read-only verification data only**.
- No re-enqueue, retry, recreate, replay, or resend to anyone — including agents who missed them.
- No changes to sent history, dedup records, idempotency keys, or queue history.
- The fix applies only to **new** Communications broadcasts created after deployment.
- All before/after verification is dry-run / read-only. No full-audience test send.
- Hot Sheets are out of scope and untouched.

## Confirmed problem

Gabrielle Russo is fully eligible (in Agent Network, all Comms channels On, all 8
property types, no price limits, not unsubscribed) yet received **zero** of the last
six broadcasts, while 70–81 agents received each.

Cause: `agent_buyer_coverage_areas` requires a ZIP and includes it in its uniqueness
rule, so the app stores counter placeholders (`00000`, `00001`, `00002`, …) for
town selections. The matcher treats only `00000`/`00001` as placeholders and enforces
`00002+` as a real ZIP restriction, which can never match a listing. Gabrielle has
346 towns saved, so only her first two are live.

Scope measured: **18 agents, 253 coverage rows**.

## Fix

1. **Normalize before matching** — in `supabase/functions/_shared/verifiedAgentAudience.ts`,
   when building `savedPrefs.geoRows` from `agent_buyer_coverage_areas` rows with
   `source = 'notifications'`, set `zip_code: null` regardless of the stored value.
   Comms geography then matches on state / county / town only.
2. **No data changes** — placeholder ZIPs stay exactly as stored. No migration, no
   updates, no delete-reinsert. They exist only to satisfy the NOT NULL + unique
   `(agent_id, zip_code, source)` constraint.
3. **Matcher untouched** — `communicationPreferencesMatcher.ts` and its `ZIP_SENTINELS`
   stay as a defensive fallback.
4. **Regression tests** —
   - town-only coverage row with placeholder `00002` matches a listing in that town;
   - higher placeholders (`00045`, `00345`) behave the same;
   - a listing in a genuinely different town still does not match;
   - ZIP matching outside the `source='notifications'` path is not weakened;
   - run existing audience + matcher tests.
5. **Read-only before/after verification** — re-evaluate the same six Aug 4–7
   broadcasts with no writes, reporting per broadcast: previous matched count,
   corrected matched count, whether Gabrielle is now included, how many of the other
   17 affected agents are newly included, and whether any previously matched
   recipient drops out. **Acceptance: zero previously matched recipients lost.** If
   any drop out, stop and investigate before deployment.
6. **No historical resend** — the six broadcasts are comparison data only.
7. **Deployment scope** — trace the real import graph of `verifiedAgentAudience.ts`
   and redeploy only the Communications producers/processors that depend on it
   (client-need producer, broadcast producer, digest processor as confirmed by the
   actual graph). No Hot Sheet functions.

## Report before deployment

Exact code diff; tests and results; six-broadcast before/after recipient table;
Gabrielle's result; results for all 18 affected agents; confirmation that zero
previously matched recipients were lost; exact list of functions needing redeploy.
**No deployment until this is reported and approved.**

After approval: deploy only the affected Communications functions. No full-audience
test send. Any live canary uses only the approved admin test recipient and must
confirm exactly one job and one delivery.
