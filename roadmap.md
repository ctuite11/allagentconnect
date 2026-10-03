# Roadmap — AAC

## 2026-10-03 — Approved production action: cron.job_run_details cleanup (IN PROGRESS)
- [x] Evidence snapshot (db 694 MB; 760,994 rows / 463 MB; oldest 2026-02-09; 718,994 deletable; uptime 7d23h; 26 conns)
- [ ] Fixed 7-day cutoff computed once, used for every batch (Chris's added safeguard)
- [ ] Batched delete of rows older than cutoff (~719k rows, ~100k per batch)
- [ ] Add daily retention job keeping cron.job_run_details to 7 days (no existing job touched)
- [ ] Plain VACUUM only (NO VACUUM FULL, no restart, no resource changes, no other changes)
- [ ] Post-cleanup report: rows removed/remaining, table size, db size, connections, cron jobs normal

## Separate items
- [ ] Weborik Phase 1 finding: pg_cron job_run_details never auto-cleaned — operational dependency to document before leaving Lovable
- [ ] Lovable support (Chris sends): identify exact metric/threshold of high-load alert; do not assume db size was the trigger
- [x] Alice Miles — done and separate from this work: account created 2026-10-03 18:10 UTC, activation email sent; no further action
