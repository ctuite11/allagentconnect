# Hot Sheet: event-specific duplicate protection (Hot Sheets stay paused)

## Goal
- Running the same status-change event twice can never produce a second email.
- A later, genuinely new move back into the same status (active → off_market → active → off_market) can send again.
- The event's `new_status` stays the only source for subject, status and delivery records. Superseded events still skip with zero jobs.

## Why the match-email function alone isn't enough
Four separate checks block a repeat today, and two of them live in the database:

| Where | Current key | Blocks a genuine repeat? |
|---|---|---|
| Delivery claim (database unique key) | listing + status + Hot Sheet + audience + recipient | Yes, permanently |
| Matching function's "already sent" filter (database) | Hot Sheet + listing + current status | Yes |
| Prior-sent check in the match-email function | Hot Sheet + listing + status | Yes |
| Email job idempotency key | Hot Sheet + listing + status (+ recipient) | Yes |

Every status-change event already has an immutable id (one row per real transition, stored on every claim, `NOT NULL`). That id becomes the dedupe identity. No timestamps are involved.

## Changes

**1. Database migration (needs your approval on the card)**
- Delivery claims: the unique key becomes **event + Hot Sheet + audience + recipient**. Checked live: all 96 existing claims already fit the new key (0 conflicts). `enqueue_hot_sheet_delivery` switches its conflict target to match. Everything else stays the same: pause handling, return values, email job insert.
- Matching: the criteria logic moves, unchanged, into an internal function (service role only) that returns criteria matches without the sent-state filter. `check_hot_sheet_matches(hot_sheet_id)` becomes a thin wrapper that adds back the exact same "already sent at current status" filter, so the app, digests and dashboards get identical results. A new service-role-only helper answers "does listing L match Hot Sheet H?" for the event path. No criteria, status list or audience rule changes.
- Not touched: the listing trigger, the outbox table, the worker, the sent-listings table structure, grants on existing public functions.

**2. Match-email function and helper**
- Calls the new per-listing criteria helper instead of the sent-state-filtered list.
- Removes the Hot Sheet + listing + status "prior sent" skip. Dedupe is now per event, through the claim.
- Idempotency keys for agent, client and subscriber get `:ev:{event_id}` added. Historical keys aren't affected.
- The sent-listings upsert stays as it is (it refreshes `sent_at` for that status). It no longer gates anything on this path.
- The race fix is kept as is: event status everywhere, supersede check before the plan and again before each Hot Sheet.

## Tests (local and throwaway database only, mocked transport)
- Same event processed twice → exactly one email job and claim; the second run returns `duplicate`.
- active → off_market → one Off Market alert.
- off_market → active → one "Now On MLS" alert.
- A later active → off_market as a new event → a second Off Market alert is allowed (new claim, new job).
- A superseded old event → zero jobs, `event_superseded`.
- Parity: the `check_hot_sheet_matches` wrapper returns identical rows before and after on the existing matcher fixtures.
- Existing suites keep passing: status-only trigger, outbox, matcher behavior, concurrency, and all Deno tests (static guards updated to require `:ev:` in keys and to forbid the status-only prior-sent skip).

## Deployment order (Hot Sheets paused the whole time)
1. Confirm `HOT_SHEET_EMAILS_PAUSED=true` and take a zero-send snapshot.
2. Apply the migration. It's additive for callers: the old function signature and RPC signature are unchanged.
3. Deploy only `send-new-match-notification`.
4. Read-only checks: still paused, worker claiming nothing, Hot Sheet queue at zero, no new claims, no Hot Sheet provider sends. Report the count.
5. Stop. No test send, no unpause.

## Technical notes
- New claim index: `UNIQUE (event_id, hot_sheet_id, audience, recipient_key)`. The old `hot_sheet_delivery_claims_logical_key` is dropped in the same transaction, after the new index exists.
- Internal criteria function: `SECURITY DEFINER`, `REVOKE` from public/anon/authenticated, `GRANT EXECUTE` to service_role. The wrapper keeps its current owner and grants.
- Migration file follows the `YYYYMMDDHHMM_description.sql` convention and is mirrored into the repo for drift protection.
