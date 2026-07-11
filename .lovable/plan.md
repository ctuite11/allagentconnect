
# Automatic agent hot-sheet notifications — implementation plan

Approved. This adds a **separate** agent-notification path so buyer/client delivery in `send-new-match-notification` stays untouched.

## Pre-implementation report (as requested)

**Canonical "verified agent" definition** (reused from `send-hot-sheet-preview-blast`):
- Row in `user_roles` with `role = 'agent'`
- Row in `agent_settings` with `agent_status = 'verified'`
- Row in `agent_profiles` with a non-blank `email`

**Canonical "preferences set" check** — same rule the preview-blast uses:
```
preferences_set = (agent_settings.preferences_set = true) OR (has ≥1 row in agent_buyer_coverage_areas)
```
No new definition invented.

**Preference matching helper — honest scope note:** `agent_buyer_coverage_areas` only stores geography (`zip_code`, `city`, `state`, `county`, `neighborhood`). Agents have **no price / bedrooms / property-type preference table in the schema today**. So "match" for a preference-set agent will be a geography match (state + city/zip/county/neighborhood, case-insensitive). Price / property-type filtering would require a new preferences table — I am not adding one in this pass. I'll flag it in the PR so you can decide whether to extend later.

**Deduplication mechanism** — new table:
```
agent_sent_listings (agent_id, listing_id, status_at_send)  UNIQUE
```
Mirrors `hot_sheet_sent_listings`. Cron retries and near-realtime triggers upsert; existing rows are skipped. Independent from buyer dedup.

**Files created**
- `supabase/migrations/<ts>_agent_sent_listings.sql` — new table + grants + RLS (service_role only writes; agents can read their own rows).
- `supabase/functions/notify-agents-new-listing/index.ts` — new dedicated function.

**Files modified**
- `supabase/functions/notify-matching-buyers/index.ts` — after the existing hot-sheet fan-out call, add a second fire-and-forget invoke of `notify-agents-new-listing` with `{ listing_id }`. Nothing else in that file changes.
- `supabase/config.toml` — register the new function (`verify_jwt = false`, invoked service-role only).

**Files explicitly NOT touched**
- `send-new-match-notification/index.ts` (buyer/client/subscriber path)
- `send-hot-sheet-preview-blast/index.ts` (one-off blast)
- `hot_sheet_clients`, `hot_sheet_subscribers`, `hot_sheet_sent_listings`, `share_tokens`
- Any accepted-invite / suppression / subscriber logic

## `notify-agents-new-listing` behavior

1. Accept `{ listing_id }` (POST, service-role or admin). Load listing; skip unless status ∈ `{ active, coming_soon, price_changed, back_on_market, extended, reactivated, new }` (the same searchable set used by hot-sheet matching).
2. Resolve verified agents (rules above). Exclude the listing's `agent_id` (self).
3. For each verified agent, classify:
   - **Preferences not set** → include unconditionally.
   - **Preferences set** → include only if listing's `state` matches any coverage row AND (`city`, `zip_code`, `county`, or `neighborhood` matches, case-insensitive). If the agent has only state-level rows, state match is sufficient.
4. Normalize by lowercased email + user_id; drop duplicates.
5. For each remaining agent, upsert `(agent_id, listing_id, status)` into `agent_sent_listings`. Only agents whose upsert inserted a new row get enqueued — this is the dedup gate for cron + near-realtime retries.
6. Enqueue one `email_jobs` row per surviving agent:
   - `template: "agent-new-listing-alert"` (distinct from the buyer `new-match-notification` template — auditable separately in `email_jobs`).
   - `payload.metadata.audience = "agent"`, `payload.metadata.reason = "preferences_match" | "preferences_unset"`.
   - `idempotency_key = "agent-new-listing:<agent_id>:<listing_id>:<status>"`.
   - Reuses the existing listing email card renderer (`renderHotSheetMatchListingEmailCard`) so styling matches the approved automatic look; does NOT use the preview-blast template.

## Verification checklist I will run before saying it's done

Using one qualifying test listing:
- [ ] Agent with matching coverage → 1 `email_jobs` row (`audience=agent`, `reason=preferences_match`).
- [ ] Agent with non-matching coverage → 0 rows.
- [ ] Verified agent with completed profile, `preferences_set=false`, no coverage → 1 row (`reason=preferences_unset`).
- [ ] Non-verified / no-role user → 0 rows.
- [ ] Listing's own agent → 0 rows.
- [ ] Second invocation for same listing/status → 0 additional rows (dedup via `agent_sent_listings`).
- [ ] Existing accepted client on hot sheet 9128adbd… still gets their `new-match-notification` job (unchanged path).
- [ ] Existing `hot_sheet_subscribers` (if any) still get their `hot-sheet-subscriber-update` job.
- [ ] `SELECT payload->>'template', count(*) FROM email_jobs WHERE created_at > now()-interval '5 min' GROUP BY 1` shows buyer and agent totals as distinct rows.

Approve to switch to build mode and I'll implement exactly the files listed above.
