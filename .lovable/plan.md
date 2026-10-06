# Status check: navigation speed-ups and capacity recorder (verification only)

No new changes. Only checks and a report.

## Confirmed in the code now
- Navigation: Success Hub 60-second cache, clearing on sign-out or account change, clearing after listing/Hot Sheet/buyer saves, scroll restored on Back and reset on forward, shared session reuse, Hot Sheets loading in parallel. All are in the code. Built OK.
- Recorder change file: adds the `sampled_at` index, fixes the blank-label bug, adds a separate hourly cleanup (7 days). The every-minute recorder has no `extract(minute ...)` check.

## Not confirmed yet (database not responding)
- Whether the recorder change is actually applied in the live database, plus the hourly job, failure history and how much history is kept.
- Live timings and request counts on Back.
- Deployment to allagentconnect.com: depends on main being pushed; not checked.
- New alert: another disk read/write budget warning at 17:09 UTC, value 15, worse than 48 at 13:04. Its timing may come before or after the change, so it can't be tied to the change yet.

## Steps once the database responds (read-only)
1. Check that the recorder (every minute) and `db-capacity-prune-hourly` (`17 * * * *`) are both active.
2. Count recorder and cleanup run results since the change; there should be no failures.
3. Check the oldest and newest samples (about 7 days kept) and that the index exists.
4. Run a signed-in timing test as Chris: Success Hub → Hot Sheets, Back within 60s (no full refetch, count requests), scroll restore, forward resets to top, and after 60s cached content shows first then refreshes quietly.
5. Report the numbers and add the 17:09 alert to the Lovable Support message.

No publishing, emails, writes, restarts or schedule changes.
