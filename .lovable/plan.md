# Reactivate the Hot Sheet sweep cron (no backfill)

## Status this morning
Hot Sheet email is healthy: 6 jobs today (3 new-match, 3 status-change), all sent and provider-confirmed delivered, single attempt, no errors. Queue is empty — nothing queued, pending, failed, or cancelled in the last 24 hours. The worker cron runs every minute.

## The one gap
The periodic Hot Sheet sweep job (`send-new-match-notification-every-15-min`, jobid 3) is still inactive from the emergency pause. Matches currently only fire from live listing events, so anything that slips past the trigger path is never retried.

## Proposed change
Re-enable that single cron job, unchanged, so the matcher runs on its schedule again.

Safety boundaries:
- Reactivation only — no historical replay, retry, backfill, or resend.
- No changes to matcher logic, templates, audience rules, or any other cron.
- Only the sweep job is touched; the worker and digest crons stay as they are.

## Verification after enabling
- Confirm jobid 3 shows active.
- Watch the first two sweep runs and report any new `email_jobs` rows created, with recipient and status.
- Confirm no duplicate sends against already-notified listings (the sent-listings dedup table gates this).

## Technical note
Single `cron.alter_job` / re-schedule on the existing job name; no migration to matcher code or templates.
