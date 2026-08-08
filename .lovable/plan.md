# Hot Sheet notification state — audit first, then decide

## Current state (verified read-only)
- Email worker cron `process-email-queue-every-minute` — **active**. Anything queued gets delivered.
- `send-new-match-notification-every-15-min` (jobid 3) — **inactive**, still off from the emergency pause work.
- `process-comms-digests` — **active**.
- Also inactive: pending message emails, price-change alerts, stale-listing reminders.
- Queue: 0 queued/pending. Last hot-sheet-template job was Jul 27; everything since was a manual one-off canary.

So the scheduled Hot Sheet sweep is paused; the event-driven path (listing insert/update to `notify-matching-buyers`) and the sender are not.

## Step 1 — read-only dry run (no changes, no emails)
Run the matcher in report-only mode over currently active Hot Sheets and recent listings to produce:
- Which Hot Sheets would match, and how many listings each.
- The distinct recipient list and total email count the sweep would generate on its first run.
- Any recipient who would receive a large burst (backlog risk from the paused period).

Nothing is enqueued, nothing is sent, no rows are written.

## Step 2 — decide after seeing the numbers
Only after you review the dry-run output:
- If volume is small and correct, reactivate cron jobid 3 with a paused verification pass first, then lift.
- If the dry run shows a backlog burst, add suppression for the paused window before reactivating.

## Safety rules held for this work
- No re-enqueue, retry, replay, or backfill of any existing or historical `email_jobs`.
- No email template or shared-builder changes.
- No cron activation in Step 1 — reactivation is a separate, explicitly approved action.