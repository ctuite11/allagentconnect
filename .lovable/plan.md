# Narrow read-only question to Lovable Support: identify the job-history full scans

## Goal
Ask Lovable Support one narrow question: identify the exact query or process responsible for the two full scans of the 463 MB `cron.job_run_details` (job-history) table. No changes to anything.

## Evidence to include in the request (all post-21:10 UTC restart window unless noted)
- The job-history table holds 47,350 rows but occupies 463 MB.
- Two full sequential scans of it produced 57,094 and 57,021 physical disk reads; all measured queries together showed 121,102 disk reads — so those two scans dominate the observed physical-read workload.
- Query writes were only 115; WAL (database change log) ~1.4 MB; zero temp files; background writer cleaned 0 pages; 99.76% of reads served from memory.
- Historical comparison only (clearly labeled as pre-restart data, NOT part of the post-restart pg_stat_statements window): minute-by-minute recorder samples around 13:04, 17:09, 18:53–21:10, and 21:14 UTC.

## The exact question
Identify the exact query or process responsible for the two full scans of the 463 MB job-history table:
1. When did each scan run?
2. What triggered it?
3. Is it AAC application code, Supabase/Lovable scheduler infrastructure (e.g. pg_cron bookkeeping), or platform maintenance?
4. Does Lovable's disk I/O budget meter count additional platform I/O that PostgreSQL statistics cannot see?

## Classification to state in the report
- Confirmed: the job-history table is producing very large physical reads.
- Likely: those full scans are the principal reason the Lovable disk I/O budget is being exhausted.
- Not yet confirmed: which exact scheduler/platform query causes the scans, and whether the budget meter counts extra platform I/O.

## Constraints
- Read-only. No writes, restart, resize, schema/index changes, schedule changes, emails, or publishing without explicit approval.
- No VACUUM FULL or table rewrite yet — that remains a separate, separately-approved decision.
- If performance degrades during the investigation, capture live evidence first and report before restarting anything.

## After the answer
Report back with Lovable's answer and a recommended next step (e.g. approved table shrink, or scheduler-side fix) for separate approval.
