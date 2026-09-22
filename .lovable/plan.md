# Hot Sheet email rule — regression audit and correction plan (revised)

Audit only so far. Nothing changed, deployed, or sent.

## 1. Live definitions

**Trigger:**

```sql
CREATE TRIGGER notify_matching_buyers_trigger
AFTER INSERT OR UPDATE OF status, state, county, city, neighborhood,
  property_type, listing_type, price, bedrooms, bathrooms, lot_size,
  square_feet, parking_spaces, garage_spaces, total_parking_spaces, agent_id
ON public.listings FOR EACH ROW
EXECUTE FUNCTION notify_matching_buyers_on_new_listing();
```

**Function:** on UPDATE it treats any of those 16 columns changing as relevant, writes a `hot_sheet_listing_events` row (`trigger_op`, `old_status`, `new_status`, `dedupe_key`), logs a stage breadcrumb, then calls `dispatch_hot_sheet_listing(NEW.id)` — which posts only `{listing_id}`, dropping `v_event_id`. Confirms both the over-broad dispatch and the lost event context.

## 2. Both paths active

- **Legacy pg_net:** trigger → `dispatch_hot_sheet_listing` → `notify-matching-buyers` → `send-new-match-notification` (no `event_id`).
- **Durable outbox:** cron job 11 (active, every minute) → `claim_hot_sheet_events` → same matcher with `event_id`.

Both terminate in the same matcher, so the race described is real: the legacy path can classify first from `hot_sheet_sent_listings` and win the delivery claim with the wrong template.

## 3. Classification bug

`send-new-match-notification` (lines ~181–209) classifies solely from `hot_sheet_sent_listings`. `trigger_op` / `old_status` / `new_status` are never read.

## 4. Corrections to make

**Database (one additive migration):**

- `notify_matching_buyers_on_new_listing()`
  - UPDATE proceeds only when `OLD.status IS DISTINCT FROM NEW.status`; all non-status columns removed from the relevance test.
  - Legacy kick now carries the event: `dispatch_hot_sheet_listing(NEW.id, v_event_id)`.
- `dispatch_hot_sheet_listing(p_listing_id uuid, p_event_id uuid DEFAULT NULL)` — adds `event_id` to the pg_net body. Existing single-argument calls keep working.
- `notify_matching_buyers_trigger` recreated as `AFTER INSERT OR UPDATE OF status`.

No table, RLS, grant, index, or lifecycle change.

**Edge functions:**

- `notify-matching-buyers` — accepts and forwards `event_id` to the matcher.
- `process-hot-sheet-events` — unchanged contract; already sends `event_id`.
- `send-new-match-notification` — loads the event row by `event_id` and classifies from it. No `hot_sheet_sent_listings` fallback for event type. A trigger-driven request with no valid event context is skipped (fail closed) and left to the durable outbox.

**Classification rule (from the event record):**

```text
trigger_op = INSERT, new_status dispatchable            -> New Match
trigger_op = UPDATE, old_status not dispatchable        -> New Match   (draft -> coming_soon/active/off_market)
trigger_op = UPDATE, old_status = new_status            -> NO EMAIL (fail closed)
trigger_op = UPDATE, both dispatchable, statuses differ -> Status Change, subject from hotSheetStatusCopy(new_status)
```

`draft` is not in the dispatchable status list, so a draft INSERT creates no event at all, and the first publication out of draft is correctly the New Match.

`hotSheetStatusCopy.ts` unchanged.

## 5. Event type to subject line

```text
listings trigger (TG_OP, OLD.status, NEW.status)
  -> hot_sheet_listing_events row (trigger_op, old_status, new_status)
  -> event_id carried on BOTH paths (pg_net body + outbox worker body)
  -> matcher loads that one event row and classifies from it
  -> template new-match-notification | hot-sheet-status-change
  -> subject from getHotSheetStatusCopy(new_status)
```

Because both paths reference the same event row, they cannot disagree, and the first one through the delivery claim already holds the correct template.

## 6. 50 Proctor Avenue

Its only recent event is `UPDATE, off_market -> off_market` (22 Sep 02:29). Under the corrected trigger that edit creates no event, no pg_net kick and no email. A later `off_market -> active` would produce one event and "Now On MLS in {name}".

## 7. Historical event audit (read-only, done)

All 67 `hot_sheet_listing_events` rows are in state `processed`. There are **no pending, failed, claimed or held events**. 10 of the processed rows are `UPDATE` with `old_status = new_status` (the regression's fingerprint). Nothing needs releasing or repairing, and no historical row will be deleted or modified. The fail-closed same-status rule still ships so any such row that were ever retried produces no email.

## Unchanged

`hot_sheet_sent_listings`, `hot_sheet_delivery_claims`, email job idempotency, recipient eligibility, matching criteria, active-hot-sheet requirement, pause controls, outbox lease/retry.

## Verification (local disposable Postgres + function tests, rollback only, no sends)

1. Off-market listing, beds-only edit → zero new events.
2. Active listing, price-only edit → zero new events.
3. `active -> off_market`, sheet never received it → one event, status-change, "Off Market update in {name}", never "New matches".
4. `draft` INSERT → no event; then `draft -> coming_soon` → one event classified New Match.
5. Same event via both paths → one logical delivery, identical template and subject.
6. Synthetic `UPDATE, old_status = new_status` event → skipped, zero email jobs.
7. Genuine later status change after an initial delivery → correct status-specific subject.

Stop before any production deployment or Hot Sheet send.
