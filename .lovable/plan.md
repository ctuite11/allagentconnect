# Lovable Support request: full scans of cron.job_run_details exhausting disk I/O budget

## What we send to Lovable Support (read-only investigation request, no changes)

**Context**

- On 2026-10-06 we received disk I/O budget warnings: 48 alerts at 13:04 UTC, 15 at 17:09 UTC, 0 at 21:14 UTC (after a user-approved restart at 21:10 UTC).
- Post-restart `pg_stat_statements` shows that ~90% of all physical reads come from full scans of `cron.job_run_details` — two observed scans alone read 57,094 and 57,021 blocks out of 121,102 total.
- The table has only ~47,350 rows but occupies ~463 MB, which is unusually large relative to its row count.
- A cleanup of old rows already ran (Oct 3), but it did not reclaim physical space, so each full scan still reads the entire 463 MB.

**Questions for Lovable**

1. Identify the exact query or process responsible for the two full scans of `cron.job_run_details`:
   - Please provide the **query text or query ID**, the **application_name / backend source** if available, and any **associated scheduler job ID** for each scan.
   - Is it AAC application code, Supabase/Lovable scheduler infrastructure (e.g., pg_cron startup cleanup or retention jobs), or platform maintenance?
2. Confirm what the ~463 MB physically consists of: the **main `cron.job_run_details` heap itself, associated TOAST data, or both**.
3. Timing: `pg_stat_statements` is aggregated and may not preserve the exact timestamp of each individual scan. If "when did each scan run?" cannot be answered from PostgreSQL statistics alone, please use **platform/query logs** rather than treating the timing as unknowable.
4. Does the disk I/O budget meter count **additional platform-internal I/O** (e.g., vacuum, replication, snapshots) beyond user-query reads?

**What we are explicitly NOT approving yet**

- No `VACUUM FULL` or table rewrite.
- No resizing (compute or disk).
- No change to cron job frequency or schedules.
- No deletion of job history.

Corrective action will be decided only after the scanning process is identified and the 463 MB composition (heap vs. TOAST/bloat) is confirmed.

## Technical details

- Evidence already gathered (read-only): `pg_stat_statements` top-reads query is a full scan of `cron.job_run_details`; table stats: 47,350 rows / 463 MB; alert counts from the metrics endpoint at 13:04 / 17:09 / 21:14 UTC.
- Pre-restart recorder samples (13:04, 17:09 normal; 18:53–21:10 stall — one task 405 s, WAL 592 MB) are historical and labeled as such, separate from the post-restart stats window (counters reset at the 21:10 restart).
- This is a support question only — no database, function, or app changes are part of this plan.
