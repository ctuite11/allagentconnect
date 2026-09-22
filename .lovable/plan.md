# Hot Sheet email rule — regression audit and correction plan

Audit only so far. Nothing was changed, deployed, or sent.

## 1. Live trigger and function definitions

**Trigger (live):**

```sql
CREATE TRIGGER notify_matching_buyers_trigger
AFTER INSERT OR UPDATE OF status, state, county, city, neighborhood,
  property_type, listing_type, price, bedrooms, bathrooms, lot_size,
  square_feet, parking_spaces, garage_spaces, total_parking_spaces, agent_id
ON public.listings FOR EACH ROW
EXECUTE FUNCTION notify_matching_buyers_on_new_listing();
```

**Function (live), relevant part:** on `UPDATE` it computes `v_relevant` as true when *any* of those 16 columns changed, then writes a row into `hot_sheet_listing_events` (`trigger_op`, `old_status`, `new_status`, `dedupe_key`), logs a stage breadcrumb, and calls `dispatch_hot_sheet_listing(NEW.id)` as a best-effort pg_net kick. Dedupe key is `listing:status:TG_OP:updated_at`.

This confirms the regression: a same-status price/beds/city/agent edit creates a Hot Sheet event and an email.

## 2. Are both paths active?

Yes — both are live and both terminate in the same function.

- **Legacy pg_net kick:** trigger → `dispatch_hot_sheet_listing` → `notify-matching-buyers` → `send-new-match-notification` (no `event_id`).
- **Durable outbox:** cron job 11 `process-hot-sheet-events-every-minute` (active, every minute) → `claim_hot_sheet_events` → `send-new-match-notification` with `listing_id` + `event_id`.

Because the trigger writes the outbox row *and* kicks pg_net, suppressing only one path would not stop the email. The fix must be at the trigger.

## 3. Second bug confirmed

`send-new-match-notification` (lines ~181–209) classifies purely from `hot_sheet_sent_listings`: no prior row → `new-match-notification`; prior row at a different status → `hot-sheet-status-change`; prior row at same status → skip. The event's `trigger_op` / `old_status` / `new_status` are never read — `event_id` is currently only a breadcrumb for delivery claims. So an Active → Off Market change on a sheet that never received the listing is mislabelled "New matches in your Hot Sheet".

## 4. Files / objects to correct

**Database (one additive migration, replace function + recreate trigger):**
- `notify_matching_buyers_on_new_listing()` — on UPDATE, dispatch only when `OLD.status IS DISTINCT FROM NEW.status`. Remove the 15 non-status columns from the relevance test. INSERT behaviour unchanged.
- `notify_matching_buyers_trigger` — narrow to `AFTER INSERT OR UPDATE OF status`.
- Both are re-asserted so the Aug 5 / Aug 16 migration bodies can no longer be the effective definition. No table, RLS, grant, or index change.

**Edge functions:**
- `supabase/functions/send-new-match-notification/index.ts` — accept optional `trigger_op` / `old_status` / `new_status` on the request body (outbox path), or read them from the event row by `event_id`; classify from the event, not from `hot_sheet_sent_listings`.
- `supabase/functions/process-hot-sheet-events/index.ts` — pass `trigger_op`, `old_status`, `new_status` from the claimed event into the matcher body.
- `supabase/functions/notify-matching-buyers/index.ts` — legacy path carries no event; it will forward `trigger_op: null`, and the matcher falls back to the existing `hot_sheet_sent_listings` classification only when no event context is present.
- `hotSheetStatusCopy.ts` — unchanged.

## 5. How event type reaches the subject line

```text
trigger row (TG_OP, OLD.status, NEW.status)
  -> hot_sheet_listing_events.trigger_op / old_status / new_status
  -> process-hot-sheet-events passes them in the matcher body
  -> send-new-match-notification:
       trigger_op = INSERT                -> template new-match-notification
       trigger_op = UPDATE, status changed -> template hot-sheet-status-change,
                                              subject from getHotSheetStatusCopy(new_status)
  -> email_jobs subject
```

`hot_sheet_sent_listings` and delivery claims keep their current role: dedupe only. A listing already sent at that exact status is still skipped.

## 6. How 50 Proctor Avenue would behave

Its only recent event is `trigger_op=UPDATE, old_status=off_market, new_status=off_market` (22 Sep 02:29). Under the corrected rule the trigger would not fire at all for that edit — no outbox row, no pg_net kick, no email to any of the five hot sheets. If that listing later moved off_market → active, one event would be created and each eligible hot sheet would receive **"Now On MLS in {name}"**, never "New matches".

## Not touched

Delivery claims, idempotency keys, criteria matching, active-hot-sheet requirement, recipient eligibility, email queue isolation, pause controls, outbox retry/lease behaviour. No email released or sent; the existing stuck queue rows stay untouched.

## Verification (rollback-only, no commits)

1. Same-status edit on an off-market listing → zero new `hot_sheet_listing_events` rows.
2. Price-only change on an active listing → zero new rows.
3. `active → off_market` on a listing a sheet never received → one event, classified status-change, subject "Off Market update in {name}".
4. New listing insert in a matching area → one event, classified new-match.
5. Repeat of case 3 at the same status → deduped, no second email.
