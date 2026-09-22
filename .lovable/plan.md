# Hot Sheet email rule — regression correction (audit + implementation plan)

Audit complete. Nothing changed, deployed, or sent yet.

## Audit findings

**Live trigger:**

```sql
CREATE TRIGGER notify_matching_buyers_trigger
AFTER INSERT OR UPDATE OF status, state, county, city, neighborhood,
  property_type, listing_type, price, bedrooms, bathrooms, lot_size,
  square_feet, parking_spaces, garage_spaces, total_parking_spaces, agent_id
ON public.listings FOR EACH ROW
EXECUTE FUNCTION notify_matching_buyers_on_new_listing();
```

**Live function:** on UPDATE, any of those 16 columns changing counts as relevant; it writes a `hot_sheet_listing_events` row (`trigger_op`, `old_status`, `new_status`, `dedupe_key`), logs a stage breadcrumb, then calls `dispatch_hot_sheet_listing(NEW.id)` — which posts only `{listing_id}`, discarding `v_event_id`.

**Both delivery paths are live:** the pg_net kick (→ `notify-matching-buyers` → matcher, no event id) and the durable outbox (cron job 11, every minute → matcher with `event_id`). The matcher classifies solely from `hot_sheet_sent_listings`, so the legacy path can win the delivery claim with the wrong template.

**Historical events (read-only):** all 67 `hot_sheet_listing_events` rows are `processed`; none pending, claimed, failed or held. 10 processed rows are `UPDATE` with `old_status = new_status`. Nothing will be deleted or modified.

**50 Proctor Avenue:** its only recent event is `UPDATE, off_market -> off_market` (22 Sep 02:29). Under the correction that edit creates no event and no email.

## Phase 0 — freeze Hot Sheets first

Set only `HOT_SHEET_EMAILS_PAUSED=true` (not the global email pause) and confirm the live runtime honours it. Then **wait two full queue-worker cycles** so any invocation already running when the pause flipped has finished, verify no Hot Sheet job is processing or claimed, and record that timestamp as the **zero-send baseline** for the maintenance window. Only then take the read-only snapshot: Hot Sheet `email_jobs` in any nonterminal state; `hot_sheet_listing_events` counts by state; any in-progress delivery claim. If anything is in flight, stop and report. The three existing protections (`assertHotSheetEnqueueAllowed`, worker claiming zero while paused, `preSendBlockReason`) stay untouched.

## Phase 1 — implementation (pause stays on)

**Database migration:**
- New overload `dispatch_hot_sheet_listing(p_listing_id uuid, p_event_id uuid)` with **no default**; the existing one-argument function is left in place untouched for compatibility and is not used by the new trigger path.
- The new overload is locked down in the same migration, matching the existing dispatcher:

```sql
REVOKE ALL ON FUNCTION public.dispatch_hot_sheet_listing(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_hot_sheet_listing(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.dispatch_hot_sheet_listing(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_hot_sheet_listing(uuid, uuid) TO service_role;
```

- `notify_matching_buyers_on_new_listing()` — UPDATE proceeds only when `OLD.status IS DISTINCT FROM NEW.status`; all non-status columns removed from the relevance test; legacy kick becomes `dispatch_hot_sheet_listing(NEW.id, v_event_id)`.
- Trigger recreated as `AFTER INSERT OR UPDATE OF status`.

No table, RLS, index or lifecycle change; the only grant change is the lockdown above.

**Edge functions:**
- `send-new-match-notification` — event id is authoritative: load that exact event row and classify from it. It must also verify `event.listing_id === request.listing_id`; on any mismatch, fail closed and create zero jobs — one event id may never classify another listing. A trigger-driven request with no valid event id is skipped (zero email jobs); no "most recent event" lookup, no `hot_sheet_sent_listings` fallback for event type.
- `notify-matching-buyers` — accepts and forwards `event_id` verbatim.
- `process-hot-sheet-events` — unchanged; it already sends the exact `event_id`.

**Classification, entirely from the event row:**

```text
INSERT, dispatchable status                 -> New Match
UPDATE, old_status not dispatchable (draft) -> New Match
UPDATE, old_status = new_status             -> NO EMAIL (fail closed)
UPDATE, both dispatchable, statuses differ  -> Status Change, subject from hotSheetStatusCopy
```

`draft` is not a dispatchable status, so a draft INSERT creates no event and the first move out of draft is the New Match. `hotSheetStatusCopy.ts` unchanged.

## Phase 2 — deploy order (consumers before producers)

1. `send-new-match-notification`
2. `notify-matching-buyers`
3. the migration

No other functions deployed.

## Phase 3 — tests (no live delivery)

Permanent regression tests only — disposable local Postgres for the trigger rules (extending `supabase/tests/db/` + `scripts/run-hot-sheet-db-tests.sh`) and Deno tests with mocked calls for classification. No production listing touched, no provider call, no queue release, no event replay.

1. Off-market listing, beds-only edit → zero events, zero jobs.
2. Active listing, price-only edit → zero events, zero jobs.
3. `active -> off_market`, sheet never received it → status-change event, `hot-sheet-status-change`, "Off Market update in {name}", never New Match.
4. Draft INSERT → zero events; `draft -> coming_soon` → one event, New Match.
5. Same event through both paths → same event id, same classification, exactly one logical delivery.
6. Synthetic `UPDATE, old_status = new_status` → skipped, zero jobs.
7. Later genuine status transition → correct status-specific template and subject.
8. Event id whose `listing_id` differs from the requested listing → fail closed, zero jobs.
9. Grants on `dispatch_hot_sheet_listing(uuid, uuid)`: no PUBLIC/anon/authenticated execute, service_role only.

## Phase 4 — production verification (still paused)

Read-only only: live trigger and function definitions correct; two-argument dispatcher present and locked down; trigger passes `v_event_id`; matcher requires matching event context; no new Hot Sheet `email_jobs`; no historical events altered or jobs released; no provider send. No real listing altered.

Final report: pause confirmed, zero-send baseline timestamp, before/after snapshots, exact migration and functions deployed, test results, and confirmation `HOT_SHEET_EMAILS_PAUSED` is still true.

**Hot Sheet provider sends attributable to this maintenance window: 0.** Anything other than zero means stop and investigate before Hot Sheets reopen.

Operating rule: pause → stabilize → snapshot → implement → deploy while paused → verify zero sends → leave paused → stop. No canary, no unpause.

## Unchanged throughout

`hot_sheet_sent_listings`, `hot_sheet_delivery_claims`, email job idempotency, recipient eligibility, matching criteria, active-hot-sheet requirement, pause controls, outbox lease/retry behaviour.
