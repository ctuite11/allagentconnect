# Reactivate the remaining paused Hot Sheets

## What the audit found
Four of your personal Hot Sheets were switched off in one bulk action at **Aug 2, 01:09:49 UTC** (identical `updated_at` to the millisecond) during the emergency email-pause work. Only `044322c7` (boston) was turned back on, on Aug 6 at 02:05 UTC, as part of the missed-listings fix. The two CANARY sheets were deactivated on Aug 5 by design after their test deliveries.

System-level state is already reopened: email pause lifted, `process-email-queue-every-minute` active, Communications digests active. The scheduled Hot Sheet matcher sweep (cron jobid 3) is still inactive; delivery currently runs on the event-driven path when a listing is created or updated.

## Step 1 — reactivate the real sheets (not the canaries)
Set `is_active = true` for:
- `b41d8741` — boston
- `0b2edc68` — rewa
- `76b4d628` — Testing mobile
- `9128adbd` — rrrrrrr

Leave both CANARY (temp) sheets off — they were disposable test rows.

If you'd rather delete the throwaway rows (`rrrrrrr`, `Testing mobile`, the two CANARY sheets) instead of reactivating them, say so and the plan narrows to just `b41d8741` and `0b2edc68`.

## Step 2 — confirm no backlog fires
Reactivation alone sends nothing: alerts are generated only when a new or updated listing arrives after the sheet is active, and already-sent listings are suppressed by `hot_sheet_sent_listings`. After the change, re-check `email_jobs` to confirm zero new queued rows.

## Safety rules held
- No re-enqueue, retry, replay, or backfill of any existing or historical `email_jobs`.
- No email template or shared-builder changes.
- No cron reactivation (jobid 3 stays off) unless separately approved.