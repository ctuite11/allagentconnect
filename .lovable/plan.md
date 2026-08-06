# Hot Sheets incident trace + fire-and-forget fix

## What the trace found (read-only, no sends, no backfill)

**The two newest qualifying listings**

| Listing | Address | Status | Price | Created |
|---|---|---|---|---|
| `e552d6d6-e3ab-4f13-9748-23449fb45dae` | 5 Hanover Street, Norfolk MA (single family) | off_market | $1,400,000 | 2026-08-05 22:27 UTC (status set 22:35) |
| `daaf7099-84f8-474e-9764-4dc8aae71f8a` | 234 Allen Street, Randolph MA | off_market | $765,000 | 2026-08-05 16:48 UTC |

Both statuses are in the dispatchable set.

**Trigger and dispatcher — they did run.** `notify_matching_buyers_trigger` exists and is enabled, covers all 15 relevant columns, and `dispatch_hot_sheet_listing()` finds the Vault secret `email_dispatch_service_role_key` (present). For the Norfolk listing the outbound request is recorded at 22:35:31 UTC with HTTP 200 and body `{"success":true,"queued":0,"hot_sheet_fanout":"invoked",...}`. The Randolph listing falls outside the ~6h pg_net response retention window, so its request row is no longer available.

**Matching proof — this is the actual reason nothing was delivered.** There are exactly 6 active Hot Sheets, all set to `immediately`. Running `check_hot_sheet_matches` read-only for all 6 returns **zero rows for both listing IDs**. Sample exclusion reasons: the Saugus/Revere/Melrose sheet is limited to those three cities (Norfolk and Randolph are not in it); the Cambridge/Brookline sheet is condo-only, $500k–$1M. No sheet covers Norfolk or Randolph. So: no criteria match, not a suppressed or idempotency-blocked send.

**Queue.** No Hot Sheet `email_jobs` rows exist for either listing (queued, sent, or failed). Recent queue traffic is transactional/system only. The queue worker cron is running every minute and returning `{"processed":0,...}` — healthy, nothing to do.

**Conclusion on the primary question:** the downstream matcher call was made (the bridge returned 200 with the fan-out marker). The fire-and-forget pattern is still a real reliability defect — it makes the outcome unobservable and can drop the call under isolate shutdown — but it is not the cause of these two non-deliveries.

## Proposed change

Even though the incident resolves to "no matching Hot Sheets", the reliability gap is real and worth closing:

1. `supabase/functions/notify-matching-buyers/index.ts`: `await` the `send-new-match-notification` invocation instead of `.then()`. On invocation error return HTTP 500 with the error; only return `hot_sheet_fanout: "invoked"` when the downstream call succeeded, and include the matcher's summary (hot sheets processed, matches, jobs queued) in the response body so the pg_net response row becomes real evidence.
2. Preserve exactly: single `listing_id` scope, service-role auth headers, Hot Sheets isolation, pause-gate short-circuit. No cron reactivation, no broad matcher.
3. Add unit tests covering: downstream success passthrough, downstream error → 500, paused gate still short-circuits without invoking downstream.

## Verification (no sends)

- Read-only replay of `send-new-match-notification` semantics against both listing IDs, expecting 0 matches, and re-confirm the matching roster from `check_hot_sheet_matches`.
- Optional controlled canary: a temporary Hot Sheet whose criteria match exactly one listing, enqueue-only, then report the recipient roster and idempotency state before any authorization to send.

Nothing is sent, resent, backfilled, or enqueued as part of this plan.
