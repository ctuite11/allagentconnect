# Site speed: measured audit and targeted fixes

Incident record is closed as corrected. This plan covers performance only.

## What the measurements show

Ranked by total database time (from live query statistics):

| Hot spot | Calls | Mean | Symptom |
|---|---|---|---|
| `agent_settings.last_seen_at` heartbeat write | 158,298 | 4.5 ms | Highest total DB time in the project; pure write volume |
| `conversation_inbox` unfiltered read | 726,585 | 0.5–4.5 ms | Second highest by volume; runs on nearly every authenticated render |
| `email_jobs` filtered by `payload->>...` | 1,270 | 337–729 ms | Admin/email pages; JSON key scan over a very large table |
| `clients_with_relationship_status` by agent | 2,476 | 214 ms | CRM/Buyers lists |
| Same view with 4-column `ilike` search | 30 | 2,698 ms (max 7.8 s) | CRM search box is the single slowest statement |
| Cron polling reads on `listings` | 166,000+ | ~1 ms | Fine per-call, but frequent full-column pulls |

Conclusion: the slowness is dominated by (a) chatty client polling and (b) three unindexed access patterns, not by page weight.

## Fixes

### 1. Reduce polling chatter (frontend)
- Presence heartbeat: pause the interval when the tab is hidden and skip the write when the last heartbeat is still fresh. Resume on visibility change.
- Presence reads (`useAgentLastSeen`, batch variant): same visibility gating, and dedupe so one shared poller serves the page instead of one per avatar.
- `conversation_inbox` reads: route through a single shared React Query key with a sane `staleTime` so the sidebar badge, threads list, and Success Hub reuse one response instead of issuing separate requests.

### 2. Index the three slow access patterns (migration)
- Expression index on `email_jobs` for the JSON key used by the admin filters, plus a supporting `created_at DESC` ordering index.
- Index supporting `clients` lookup by owning agent with `created_at DESC` ordering.
- Trigram indexes on the client name/email/phone columns so the CRM `ilike` search stops scanning every row.

### 3. Cheap frontend load wins
- Verify route-level code splitting covers the heavy admin and listing pages; lazy-load any that are still in the main bundle.
- Add `loading="lazy"` / explicit dimensions on listing and hot sheet imagery where missing.

## Verification
- Re-run `EXPLAIN (ANALYZE)` on each targeted query before and after the indexes and record the plan change.
- Re-read query statistics after deploy to confirm total time on the top offenders drops.
- Confirm presence still flips to Online within the existing 5-minute window after the heartbeat change.

## Out of scope
- No email sends, replays, backfills, or queue changes.
- No visual redesign; existing canonical components stay as they are.
