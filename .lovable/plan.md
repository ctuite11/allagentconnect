
# Audit: agents classified as "preferences set"

**No code changes. No data changes. No emails sent. Queue stays paused.**

## Headline finding

The earlier "41 preferences-set / 22 fallback" split was wrong. Re-run against the exact rule in `supabase/functions/_shared/verifiedAgentAudience.ts` on the current 64 profile-complete verified agents:

| Bucket | Count |
|---|---|
| Profile-complete verified agents | **64** |
| Classified `preferences_set = true` | **19** |
| Classified `preferences_set = false` (fallback bucket) | **45** |

The 22 recipients on Frank's broadcast = 45 fallback − Frank (self) − 22 opt-outs/dedup/etc. The "41 vs 22" number from earlier was a miscount; the real preferences-set population is 19.

## What is flagging those 19 agents (row-level breakdown)

Rule today (`verifiedAgentAudience.ts` lines 92-127): an agent is `preferences_set` if **any** of these is true:
1. ≥1 row in `agent_buyer_coverage_areas` with `source='notifications'`
2. `notification_preferences.property_types` non-empty
3. `min_price` or `max_price` non-null
4. `has_no_min = true` or `has_no_max = true`

Breakdown of the 19 by the **first** trigger that fires (in that order):

| Trigger | # agents | Notes |
|---|---|---|
| Notifications-sourced geography rows | **4** | Bateson, Beauregard, Godino, Rivera — all have actual city coverage rows they saved through Comms Center. **Deliberate.** |
| `property_types` non-empty (no geo) | **13** | e.g. Archung, Argabrite, **Frank Carroll**, Cohen, Covelle, Dailey, … Every one has 3–5+ property types. |
| Price bound (no geo, no property types) | **1** | Betsy McCombs — min 100k / max 80M, `has_no_min=true`, `has_no_max=true`. Looks like a default-ish "everything" save. |
| Only `has_no_min` / `has_no_max` = true | **0** | Suspicion refuted: no agent is flagged by open-bound checkboxes alone. |
| Legacy state/county tables | **0** | Not consulted by the current audience helper (already excluded). |

Your suspicion about `has_no_min` / `has_no_max` defaults **is not the cause** — 0 agents are flagged by that field alone. The real driver is `property_types`.

## What the Comms Center UI actually writes

`src/pages/ClientNeedsDashboard.tsx` line 141-169 (the Save handler):

- Upserts `min_price`, `max_price`, `has_no_min`, `has_no_max` from `PriceRangePreferences` state.
- Upserts `property_types` from `propertyTypesRef.current` as whatever array the property-types control returned.

DB defaults: `min_price NULL`, `max_price NULL`, `has_no_min false`, `has_no_max false`, `property_types '[]'`. A row that only exists because some other setting was toggled (e.g. `client_needs_enabled`) would still leave `property_types = []` and would **not** trip the filter — so a bare insert isn't causing false positives.

The 13 property-types agents all have non-empty arrays with 3–5 concrete types. That means they went through the property-types control and it wrote a non-empty array. **Two questions remain, and the audit can't answer them without you:**

1. Does the property-types control preselect any types when an agent first opens Comms Center → Preferences? If it renders with the common types already checked, an agent who clicks Save (or lands on Save via another card like Price or Geography) will look "deliberate" when they never touched property types.
2. Same question for the "select all 8 types" pattern — 2 of the 19 agents have all 8 types selected, which is what a "select-all" preset would produce.

If either preselect exists, those 13 agents are false positives; if not, they genuinely configured targeting.

## Answers to the three questions you asked

1. **How many genuinely configured Comms Center preferences?**
   - Confirmed deliberate: **4** (the notifications-geo agents).
   - Ambiguous, pending answer to the two UI questions above: **15** (13 property-types + 1 price-only + 1 all-8-types).
2. **How many are false positives from defaults / legacy?**
   - From DB defaults alone (`has_no_min`/`has_no_max` only, or empty `property_types`): **0**.
   - From legacy `agent_state_preferences` / `agent_county_preferences` / non-`notifications` coverage rows: **0** (already excluded).
   - Potential false positives from UI preselects: up to **15**, contingent on UI answer.
3. **Exact correction needed so only deliberate configuration counts:**
   - Tighten the `preferences_set` rule in `verifiedAgentAudience.ts` to **only** trust `agent_buyer_coverage_areas` rows with `source='notifications'`. Treat `notification_preferences` (price + property_types) as *matching criteria*, not as a "prefs are configured" signal. This makes "deliberate configuration" = "agent added at least one Comms Center coverage city," which is the same bar the Preferences UI already prompts for.
   - Under that rule, the fallback bucket for Frank's Marina Bay broadcast becomes **60** of 64 profile-complete agents (64 − 4 with notif-geo), before self / opt-out / dedup.
   - This is a policy tightening, not a code change I'm making now — you asked for audit only.

## Row-level detail available on request

I have the full 19-row table (agent id, name, email, `notif_cov_rows`, `cov_cities`, `min_price`, `max_price`, `has_no_min`, `has_no_max`, `property_types`, `pt_len`, `np_created`, `np_updated`, trigger_field). Say the word and I'll export it to `/mnt/documents/prefs_set_audit.csv` — still no writes to the app DB.

## Next step I need from you

Confirm which of these to do (still audit-only until you say otherwise):

- (a) Export the 19-row CSV.
- (b) Inspect the property-types control to answer whether it preselects types, so we can finalize how many of the 13 are false positives.
- (c) Both.

No changes will be made to notification logic, the send queue, or the database until you approve the correction in question 3 above.
