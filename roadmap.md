# Roadmap — AAC

## 2026-10-03 — Approved production action: cron.job_run_details cleanup (DONE 2026-10-03)
- [x] Evidence snapshot (db 694 MB; 760,994 rows / 463 MB; oldest 2026-02-09; 718,994 deletable; uptime 7d23h; 26 conns)
- [x] Fixed 7-day cutoff (2026-09-26 20:47:33 UTC, used for every batch) computed once, used for every batch (Chris's added safeguard)
- [x] Batched delete (~718k rows removed; 49,988 remain incl. 42k kept + 7.9k margin trimmed by retention job) of rows older than cutoff (~719k rows, ~100k per batch)
- [x] Daily retention job added (aac-job-run-details-retention, 00:00 UTC; no existing job touched) keeping cron.job_run_details to 7 days (no existing job touched)
- [x] Plain VACUUM run; no VACUUM FULL, no restart, no other changes (NO VACUUM FULL, no restart, no resource changes, no other changes)
- [x] Post-cleanup report delivered (db 695 MB — dead space reused, not returned; table 463 MB; 19 conns; all AAC cron jobs running): rows removed/remaining, table size, db size, connections, cron jobs normal

## Separate items
- [x] Move first-publish social choices to Add Listing above the final actions; persist defaults, keep confirmation listing-only, preserve closed test gate, and complete non-destructive QA (2026-10-05)
- [ ] Weborik Phase 1 finding: pg_cron job_run_details never auto-cleaned — operational dependency to document before leaving Lovable
- [ ] Lovable support (Chris sends): identify exact metric/threshold of high-load alert; do not assume db size was the trigger
- [x] Alice Miles — done and separate from this work: account created 2026-10-03 18:10 UTC, activation email sent; no further action
- [x] Heavy-load message: find origin (Lovable/AAC/database/preview) — read-only (2026-10-06)
- [ ] Navigation speed plan for items 1,2,3,5 (Success Hub cache, Back scroll, single session check, parallel Hot Sheets) — awaiting approval; #4 Network Activity excluded
- [x] Full read-only infra audit: rollbacks, job cost/frequency, 13:04 alert, verified-agent lookup, Success Hub load share (2026-10-06)
- [ ] Capacity recorder: index, null-label fix, separate hourly prune job
- [ ] Navigation: Success Hub cache, Back scroll restore, shared session, Hot Sheets parallel

- [x] Hot Sheet first batch: send to attached buyer on Review Matches, no contact picker (built, deployed, and browser-verified without sending, 2026-10-06)
- [x] Read-only disk I/O budget root cause (2026-10-06): since 21:10 restart ~90% of physical reads = full scans of bloated cron.job_run_details (47k rows / 463 MB). Pre-restart cause unknown (stats wiped). Fix (rewrite/shrink that table) awaits approval.
