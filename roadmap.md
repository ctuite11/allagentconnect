# Roadmap — AAC

## 2026-10-09 — Add Listing documents
- [x] Add "Floor Plan" to Type of Document (stored as `floor_plan`); dedicated Floor Plans media section untouched.
- [x] Added documents row: Document Type is the main line, uploaded filename underneath (display-only; type-check passed).
- [ ] Browser QA with a Draft: add a Floor Plan PDF, save, reopen, confirm label and row order (no publish).

## 2026-10-09 — Manage Photos/Floor Plans return flow
- [x] Save & Return goes back to the original form context; Add listing heading only for creation-flow drafts; scroll to media section; scroll flag cleared, creation flag kept.
- [ ] Signed-in browser QA with a Draft (no publish).

## 2026-10-09 — Developer access prelaunch hide
- [x] Add one reversible flag that hides the Developer request choice and blocks direct request, sign-in, and private workspace routes.
- [x] Run focused safeguards and type-check; verify Agent request/login paths remain available (6 tests passed; preview routes verified 2026-10-09).
- [ ] Deploy through GitHub `main` → Netlify and verify the hidden state on allagentconnect.com.

## 2026-10-09 — DCMLS prelaunch UI hide
- [x] Extend the existing reversible flag to all agent-facing DCMLS surfaces; preserve stored values and backend logic (4 focused regression tests passed).
- [x] Verify signed-in UI without saving, publishing, sending, or changing data (Settings, Profile, Add, Edit, Requests redirect).
- [x] Verify production deployment at allagentconnect.com through the existing automatic GitHub → Netlify path (signed-in live checks passed 2026-10-09; no DCMLS text/controls in checked surfaces).
- [x] Reconfirm the complete production checklist read-only: Settings, Profile, Add, Edit, sidebar, request redirects, and preserved stored DCMLS values (passed 2026-10-09; no saves or writes).

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
- [x] Hot Sheet Review connected-state fix: connected = active relationship only (matches process-hot-sheet); verified without sending, 2026-10-07
- [x] Stale invite fix: global invite eligibility ignores tokens whose contact/Hot Sheet is confirmed deleted (2026-10-07, no sends)
- [x] Restore Add Additional Contact on Create Hot Sheet (incl. when opened from a buyer)
- [ ] Real Send First Batch & Invite test — awaiting approval
- [x] Read-only disk I/O budget root cause (2026-10-06): since 21:10 restart ~90% of physical reads = full scans of bloated cron.job_run_details (47k rows / 463 MB). Pre-restart cause unknown (stats wiped). Fix (rewrite/shrink that table) awaits approval.
- [x] Fix Send First Batch 403: pass bearer token to getUser() in process-hot-sheet recipient branch (done 2026-10-07): deployed, controlled pending-buyer test passed (8 IDs stored, zero email_jobs), publish requested
- [x] Read-only trace of stale May invite (done 2026-10-07)
- [ ] Publish Add Additional Contact + stale-invite eligibility fixes (no sends; user tests live): fixes committed (68bc647ab); Lovable Publish skipped (lovable.app copy broken platform-side); production = GitHub main sync → Netlify; verify allagentconnect.com bundle live after sync (currently stale — neither fix string present)

- [ ] Weborik/Nenad read-only Phase 1 access: Viewer invite (user does via Share); direct read-only DB login blocked, since Lovable Cloud has no external DB connections. Waiting on user to pick an alternative.
- [x] Admin 'Share to AAC Social' button on property page (admin's own accounts; retry reuses clientRequestId; no backend changes) (2026-10-08)

- [x] Incident 2026-10-09: My Listings Quick Edit price-only for drafts (paused Hot Sheet emails; 234 Friend St back to Draft)
- [ ] Live QA of Quick Edit on a throwaway draft after deploy, then user decides when to unpause Hot Sheet emails

- [x] Live QA of Open House date fix on production (before/after status + Hot Sheet/email counts; stop on any anomaly)
- [x] Search cards (preview; not yet live): stack event banners under status; List View uses Broker Tour label

## 2026-10-10 — List View event bar color matches event type
- [x] Match the event bar to the photo badge: broker_tour = light purple bg / purple text+border, in_person = light green bg / green text+border (display-only; layout, spacing, icon, date/time format, row size unchanged). Type-check passed; preview verified in List View (Broker Tour bar renders purple, open house classes resolve to green).
- [x] Deployed through GitHub `main` → Netlify and verified live on allagentconnect.com (Broker Tour bar renders light purple with purple text/border, row height unchanged at 34px; 2026-10-10).

## 2026-10-10 — Detail page event banners
- [done] PropertyDetail hero: upcoming Broker Tour/Open House badges stacked under status badge, reusing useListingBanners + ListingPhotoBannerBadge/formatOpenHouseLabel; preview QA passed (purple BROKER TOUR / green OPEN HOUSE, Oct 15 · 11:30 AM–1:30 PM); test events removed; deployed main@00671a90
- [x] Banner font size matched to status badge (`text-xs` on ListingPhotoBannerBadge usage); preview QA on 6 Sheridan St: both badges compute 12px, banner styling/stacking unchanged; build OK; not yet deployed (awaiting go-ahead)
