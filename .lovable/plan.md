# Hot Sheet listing updates this morning — what happened, and one bug to fix

## What ran today

One new listing was created this morning: **L-1291, 59 Court Street, Medford MA, $695,000** (created 13:06 UTC / 9:06 ET).

Its status path and the resulting alerts:

```text
13:06  created as draft            -> no alert (correct)
13:08  draft -> off_market         -> 3 "new match" emails sent + delivered
13:13  off_market -> coming_soon   -> 3 "status change" emails sent + delivered
```

All 6 jobs succeeded on the first attempt, provider-confirmed delivered, no errors, and the dedup table recorded all 6 (hot sheet, listing, status) rows. Three Hot Sheets matched — all belonging to chris@allagentconnect.com. No other agent's Hot Sheet matched Medford criteria, so nothing was missed for other recipients.

Mechanically, the pipeline worked: the listing trigger fired, the matcher ran, jobs enqueued, the worker sent them, and dedup prevented repeats at the same status.

## The bug

The 13:08 send went out as a **new match** announcement while the listing's status was **off_market**. A listing that has never been publicly live should not be introduced to Hot Sheet recipients as a new match in an off-market state. The matcher's "new match" path does not filter on status — it alerts on whatever status the listing currently holds. The status-change path is fine; off_market is a legitimate change to announce for a listing recipients already saw.

Net effect this morning: recipients got an "off market" new-listing alert at 9:08 ET, then a "coming soon" alert five minutes later for the same address.

## Proposed fix

Restrict the **new-match** path in `send-new-match-notification` to genuinely marketable statuses: `new`, `coming_soon`, `active`, `back_on_market`. Any other current status (draft, off_market, cancelled, expired, sold, etc.) is skipped for first-time announcement.

Leave the status-change path unchanged — once a recipient has seen a listing, off_market and other transitions are still valid updates.

Also record a dedup row for skipped first-appearances so that when the listing later becomes coming_soon or active, it is treated as the recipient's first real introduction (a new match), not a status change.

## Safety boundaries

- Forward-looking only. No replay, retry, backfill, or resend of anything already delivered.
- No changes to Hot Sheet criteria matching, audience rules, templates, or any cron.
- The paused sweep cron (jobid 3) stays paused unless separately approved.

## Verification

- Unit-level: extend the existing matcher parity test to assert a draft/off_market listing produces zero new-match sends and a non-zero status-change send once already seen.
- Live: create a listing in a paused/off-market state and confirm zero rows appear in `email_jobs`, then flip it to coming_soon and confirm exactly one new-match send per matching Hot Sheet.

## Technical notes

Change is confined to `supabase/functions/send-new-match-notification/index.ts` (the `newMatchListings` classification block around the prior-send lookup) plus the shared status helper if a marketable-status list is added there. Requires redeploying only that function. No migration.
