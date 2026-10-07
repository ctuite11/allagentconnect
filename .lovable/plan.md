# Lovable Support request: read-only investigation of the cron.job_run_details full scans

## What we send to Lovable Support — exactly as the user wrote it

> Please run a **read-only investigation** to identify the exact query or process responsible for the two full scans of `cron.job_run_details`.
>
> Current evidence:
>
> - `cron.job_run_details` has about **47,350 rows** but occupies about **463 MB**.
> - Two full sequential scans produced **57,094** and **57,021 physical disk reads**.
> - All measured queries together showed **121,102 disk reads**, so those two scans account for most of the observed physical-read workload.
> - Query writes were only **115**.
> - WAL was about **1.4 MB**.
> - There were **zero temp files**.
> - Background writer cleaned **0 pages**.
> - About **99.76% of reads were served from memory**.
>
> Please answer these specific questions:
>
> 1. **When did each of the two scans run?**
> 2. **What exact query or process triggered each scan?**
> 3. Is the source:
>    - AAC application code,
>    - Supabase/Lovable scheduler infrastructure such as `pg_cron`,
>    - or platform/database maintenance?
> 4. Please provide the **query text or query ID, `application_name`/backend source, and associated cron/job ID**, if available.
> 5. Please confirm whether the ~463 MB being read is primarily the table heap, TOAST data, indexes, or a combination.
> 6. Does Lovable's disk I/O budget meter include any platform-level I/O that PostgreSQL statistics do not expose?
>
> If `pg_stat_statements` cannot provide the exact timing of each scan, please use the available **platform/query logs** to identify when they occurred.
>
> My current classification is:
>
> - **Confirmed:** `cron.job_run_details` is producing very large physical reads.
> - **Likely:** those full scans are the main reason the disk I/O budget is being exhausted.
> - **Not yet confirmed:** the exact process causing the scans and whether Lovable's budget meter includes additional platform I/O.
>
> **Constraints:** read-only only. Do not restart, resize, change schema or indexes, change schedules, run `VACUUM FULL`, rewrite tables, send emails, or publish anything without my explicit approval.
>
> If performance degrades during the investigation, capture the live evidence first and report back before restarting anything.
>
> Please report the cause and your recommended next step, but do not make any changes.

## Plan

1. Send the message above verbatim to Lovable Support as the investigation request.
2. Nothing else changes in the app: no code edits, no database changes, no schedules touched.

## Explicitly not approved yet

- No `VACUUM FULL` or table rewrite.
- No resizing (compute or disk).
- No change to cron job frequency or schedules.
- No deletion of job history.

Corrective action will be decided only after the scanning process is identified and the 463 MB composition (heap vs. TOAST/bloat) is confirmed.

## Technical details

- Evidence already gathered (read-only): top-read query in `pg_stat_statements` is a full scan of `cron.job_run_details` (57,094 and 57,021 block scans of 121,102 total); table stats: 47,350 rows / 463 MB.
- Pre-restart recorder samples (13:04, 17:09 normal; 18:53–21:10 stall — one task 405 s, WAL 592 MB) are historical and labeled as such, separate from the post-restart stats window (counters reset at the 21:10 restart on 2026-10-06).
- This is a support question only — no database, function, or app changes are part of this plan.
