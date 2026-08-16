# 44 Ashwood Ave — Hot Sheet silent-drop diagnosis (read-only findings + proposed fix)

Diagnosis only. Nothing was resent, retried, backfilled, enqueued, or written. No code or data changed.

## What the evidence shows

**Log availability**
- Edge Function logs for `notify-matching-buyers` and `send-new-match-notification` for Aug 14, 18:37–18:40 UTC are **no longer retained** (both functions return "no logs found" — retention is far shorter than 48h).
- `net._http_response` retains only ~6 hours (oldest row: Aug 15 20:00 UTC). The Aug 14 dispatch response is gone.
- Conclusion: the chain cannot be traced from logs. Findings below come from schema/state inspection and a strict dry-run of the matcher.

**Listing state (read-only)**
- `e5f05daf… / 44 Ashwood Avenue, Wilmington, MA` — created Aug 7 17:31 UTC, single transition `draft → coming_soon` at **Aug 14 18:37:50 UTC**, price $1,299,000, `for_sale`, `hidden_from_market_activity = false`.
- `5f46fa9c… / 23 Burnham Street, Somerville` — went `coming_soon` Aug 14 01:23 UTC and has a `hot_sheet_sent_listings` row at 01:23:31 for hot sheet `044322c7`.
- Ashwood has **zero** rows in `hot_sheet_sent_listings` and **zero** `email_jobs`.

**Matcher dry-run (read-only)**
- `check_hot_sheet_matches('044322c7…')` executed now returns 25 candidates, and `e5f05daf…` **is in the result set**.
- So Hot Sheet 044322c7 ("boston": state MA, statuses active/back_on_market/coming_soon/off_market, no other filters) **does match Ashwood**. The matcher is not the drop point.

**Chain integrity (current state)**
- `notify_matching_buyers_trigger` exists on `public.listings` as `AFTER INSERT OR UPDATE OF status, …` and calls `dispatch_hot_sheet_listing(NEW.id)` — the Aug 14 status change was a qualifying event.
- `dispatch_hot_sheet_listing` reads the Vault secret `email_dispatch_service_role_key` and issues `net.http_post` to `notify-matching-buyers`. Every failure path (`null id`, `listing not found`, `missing vault secret`, plus a catch-all `EXCEPTION WHEN OTHERS`) only does `RAISE WARNING` and returns NULL — **no durable record**.
- `notify-matching-buyers` returns `200 {paused: true, hot_sheet_fanout: "skipped"}` when the Hot Sheet pause switch is set — also **no durable record**.
- `pg_net` queue is currently empty (0 rows) and recent cron dispatches all return 200, so the transport is healthy now.

## Answers to the six questions

1. **Did `dispatch_hot_sheet_listing` reach `notify-matching-buyers`?** Unknown — not recoverable. Both pg_net response rows and Edge logs for Aug 14 have aged out, and the dispatcher writes no audit row.
2. **Did `notify-matching-buyers` identify Hot Sheet 044322c7?** Unknown for Aug 14. The matcher it calls does match Ashwood to 044322c7 today, so if it was reached, the hot sheet would have been identified.
3. **Was `send-new-match-notification` invoked?** No evidence it was. It writes `hot_sheet_sent_listings` on success; no row exists for Ashwood on any hot sheet, and no `email_jobs` row was created.
4. **Exact failure/drop point and logged error.** Not determinable from retained data. The drop is upstream of the matcher (trigger → dispatcher → HTTP → notify-matching-buyers), where every failure mode is silent by design: `RAISE WARNING` in the trigger and dispatcher (not persisted), plus a silent 200 "paused" short-circuit. No error was logged anywhere durable.
5. **Isolated or systemic?** The *matching logic* is fine and Ashwood-specific data is fine. The *observability gap* is systemic: any listing event can be dropped by the dispatcher or the pause gate with zero durable trace, and the difference between Burnham (01:23) and Ashwood (18:37) is exactly the kind of intermittency this blind spot hides. Whether the drop cause recurs cannot be established without instrumentation.

## 6. Smallest targeted fix — proposal only, not implemented

Add durable dispatch instrumentation so the next occurrence is provable, before changing any delivery behavior.

- New table `public.hot_sheet_dispatch_log` (`listing_id`, `old_status`, `new_status`, `trigger_op`, `outcome` — one of `dispatched` / `skipped_not_dispatchable` / `skipped_no_vault_secret` / `error`, `pg_net_request_id`, `error_text`, `created_at`), service-role only, RLS on, no `anon`/`authenticated` grants.
- `notify_matching_buyers_on_new_listing` and `dispatch_hot_sheet_listing` write exactly one row per listing event, including on the `EXCEPTION WHEN OTHERS` path (insert kept non-fatal so a logging failure can never block a listing save).
- A small read-only reconciliation view joining `hot_sheet_dispatch_log` → `hot_sheet_sent_listings` → `email_jobs` so a dispatched-but-never-delivered listing is visible in one query.

Explicitly out of scope of that fix: no resend, no backfill, no catch-up sweep, no matcher changes, no pause-state changes. Once instrumentation is in place, the next qualifying listing event either proves the chain works or names the exact drop point.

## Note

There is an unrelated pre-existing TypeScript build error in `src/components/developments/DocumentRow.tsx` (line 23, `result.message` narrowing on the document-URL result union). Plan mode does not permit code edits; say the word and I will fix it in build mode.
