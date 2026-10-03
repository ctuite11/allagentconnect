# cron.job_run_details cleanup — approved safeguards applied

Chris approved the cleanup with safeguards. Plan mode requires one final approval before the production write.

## Evidence captured (read-only, 2026-10-03 20:45 UTC)

| Item | Value |
|---|---|
| Total database size | 694 MB |
| cron.job_run_details rows | 760,994 |
| cron.job_run_details size (incl. indexes) | 463 MB |
| Rows older than 7 days (to delete) | 718,994 |
| Oldest / newest run | 2026-02-09 / now |
| Database uptime | 7 days 23 h (no recent restart) |
| Connections | 26 total, 2 active |

## Steps (exact, nothing else)

1. **Batched delete** — remove the 718,994 rows older than 7 days in ~100,000-row batches (ctid-limited deletes, one small transaction per batch; ~8 batches). Keeps every delete short-lived; no long lock on the live table.
2. **Retention job** — `cron.schedule` a daily job (once per day at midnight UTC) that deletes `cron.job_run_details` rows older than 7 days, so this never re-accumulates. No existing cron job is touched or rescheduled.
3. **Plain VACUUM** — a normal (non-blocking) `VACUUM` on the table afterwards so freed space is marked reusable. **No VACUUM FULL, no restart, no resource change.**

## Post-cleanup report

- Rows removed and rows remaining
- Table size and total database size (note: disk space may not shrink immediately — Postgres reuses it; growth stops, which is the goal)
- Connections/activity snapshot
- Confirmation all existing cron jobs (status updater, capacity sampler, email queue wake) kept running normally

## Explicitly not doing

No VACUUM FULL, no restart, no changes to existing AAC scheduled jobs, no application behavior changes, no resource upgrades, no unrelated cleanup ("optimizing other things while in there").

## Bookkeeping

- Record this as a Weborik Phase 1 finding: pg_cron run-history is never auto-cleaned — an operational dependency to understand before leaving Lovable.
- Keep the high-load-alert metric/threshold question as a separate item for Lovable support (Chris sends); do not assume database size triggered it.
- Alice Miles stays fully separate; her account was already created and her activation email sent at 18:10 UTC.
