# Roadmap — AAC

## 2026-10-11 — 16 N Mead closeout (Draft-publish protection)
- [x] 1. Confirm production SHA + live bundle uses publish_listing(); no Draft→non-Draft direct write path
- [x] 2. Read-only 16 N Mead write-path investigation
- [x] 3. Guard check: agent + service-role Draft→Coming Soon rejected; non-Draft insert rejected
- [x] 4. Disposable-listing QA (emails paused); delete disposable test listing
- [x] 5. Pass/fail report; hold Manage Photos/Floor Plans deploy
- [x] Turn Hot Sheet emails back on (unpaused 2026-10-11; four clean worker cycles, no old emails, incident counts unchanged)
- [x] Manage Photos/Floor Plans changes live (auto-deployed 01:06 UTC) + live QA passed 2026-10-11
- [x] Pre-unpause Hot Sheet check reported

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
- [ ] Real Send First Batch & Invite test — ON HOLD, needs explicit approval for one controlled invitation email
- [x] Read-only disk I/O budget root cause (2026-10-06): since 21:10 restart ~90% of physical reads = full scans of bloated cron.job_run_details (47k rows / 463 MB). Pre-restart cause unknown (stats wiped). Fix (rewrite/shrink that table) awaits approval.
- [x] Fix Send First Batch 403: pass bearer token to getUser() in process-hot-sheet recipient branch (done 2026-10-07): deployed, controlled pending-buyer test passed (8 IDs stored, zero email_jobs), publish requested
- [x] Read-only trace of stale May invite (done 2026-10-07)
- [x] Publish Add Additional Contact + stale-invite eligibility fixes — deployed and verified live on allagentconnect.com via GitHub main → Netlify (no sends)

- [ ] Weborik/Nenad read-only Phase 1 access: Viewer invite (user does via Share); direct read-only DB login blocked, since Lovable Cloud has no external DB connections. Waiting on user to pick an alternative.
- [x] Admin 'Share to AAC Social' button on property page (admin's own accounts; retry reuses clientRequestId; no backend changes) (2026-10-08)

- [x] Incident 2026-10-09: My Listings Quick Edit price-only for drafts (paused Hot Sheet emails; 234 Friend St back to Draft)
- [x] Live QA of Quick Edit on a throwaway draft after deploy (price-only, no status selector, Draft preserved); Hot Sheet emails unpaused afterward

- [x] Live QA of Open House date fix on production (before/after status + Hot Sheet/email counts; stop on any anomaly)
- [x] Search cards (preview; not yet live): stack event banners under status; List View uses Broker Tour label

## 2026-10-10 — List View event bar color matches event type
- [x] Match the event bar to the photo badge: broker_tour = light purple bg / purple text+border, in_person = light green bg / green text+border (display-only; layout, spacing, icon, date/time format, row size unchanged). Type-check passed; preview verified in List View (Broker Tour bar renders purple, open house classes resolve to green).
- [x] Deployed through GitHub `main` → Netlify and verified live on allagentconnect.com (Broker Tour bar renders light purple with purple text/border, row height unchanged at 34px; 2026-10-10).

## 2026-10-10 — Detail page event banners
- [done] PropertyDetail hero: upcoming Broker Tour/Open House badges stacked under status badge, reusing useListingBanners + ListingPhotoBannerBadge/formatOpenHouseLabel; preview QA passed (purple BROKER TOUR / green OPEN HOUSE, Oct 15 · 11:30 AM–1:30 PM); test events removed; deployed main@00671a90
- [x] Banner font size matched to status badge (`text-xs` on ListingPhotoBannerBadge usage); preview QA on 6 Sheridan St: both badges compute 12px, banner styling/stacking unchanged; build OK; not yet deployed (awaiting go-ahead)

## 2026-10-10 (listing search header)
- Remove sticky positioning from Listing Search results toolbar (`/listing-results`) — approved, single class change in `src/pages/ListingSearchResults.tsx`. Preview verification: [done] — toolbar computed position static; after scroll it moves to y=-1168 (fully offscreen) while first card scrolls with it; no sticky/fixed elements remain in results; map-split header unchanged; no page errors. Not deployed.

## 2026-10-10 (developments sidebar hide)
- Hide Developments from agent sidebar (desktop + mobile) behind `DEVELOPMENTS_UI_ENABLED = false`; pages/routes/admin reviews untouched; add guard test; verify tests, type-check/build, signed-in preview. No deploy. [done]

## 2026-10-10 Draft → Live server guard
- [x] Migration A: listing_publish_audit + publish_listing(p_listing_id, p_operation_id) (failed op IDs durable)
- [x] Frontend: all Draft saves keep draft; only "Yes, Publish Listing" calls publish_listing; remove publishConfirmedRef
- [x] Migration B: guard triggers (Draft → any status blocked; non-draft inserts rejected)
- [x] QA with disposable Draft, Hot Sheet emails paused; report before production
- [x] Turn Hot Sheet emails back on (done 2026-10-11)

- [ ] Follow-up (not urgent): Hot Sheet "email me a copy" agent copy uses a time-based duplicate key (process-hot-sheet) — can repeat if delivery is triggered twice. Logged Oct 11; do not change without approval.
- [x] Hot Sheet Review header count = listings shown
- [x] Hot Sheet Review picks pinned at top
- [ ] Connected-buyer Send First Batch test — ON HOLD (needs approval for one controlled invitation email); Review UI work closed 2026-10-13

## 2026-10-13 — Restore Chris's Communications Center emails (hidden account)
- [x] Per-account `comms_email_when_hidden` switch, on for Chris only; core Comms paths only; deployed and verified, zero sends.

## 2026-10-13 — Personal vs Buyer Hot Sheets
- [x] Explicit Personal/Buyer type on new sheets; legacy sheets untouched
- [x] Server-side block (DB triggers + invite/first-batch functions)
- [x] Self-invite warning in Create and Review
- [x] Clean up "mine" (Personal, listing kept, link cancelled, contact deleted, bounce history kept)
- [ ] Save Draft / auto-persist for Hot Sheet creation — separate plan to present next (no changes yet)

## 2026-10-13 — Hot Sheet Save Draft
- [x] Drafts saved on the server, autosave, unsaved-changes prompt, Drafts section first, Continue Editing/Rename/Delete
- [x] All-or-nothing finish; drafts can be fully blank (type stays blank); no buyer needs from drafts
- [x] Isolated-database tests (10/10) and preview save/resume/delete check (no activation, no sends)

## 2026-10-14 — Save Draft reliability fix + LinkedIn banner
- [x] Create window never removed by background refreshes; one fixed draft ID per editing session; retries update the same row; quick remount resumes same draft; deliberate Create starts fresh
- [x] Preview QA: 4 autosaves → 1 row, reload → no new row, resume → same row; test drafts removed
- [ ] Production QA on allagentconnect.com — waits for this change to deploy (goes out when this turn ends)
- [x] LinkedIn banner 1584x396 JPEG delivered to Files

- [x] Create Agent email follow-up audit (read-only): reconcile counts, same-age activation comparison, link validity, Compass/Corcoran delivery signals, tracking usefulness, evidence for pacing. No template/tracking/queue changes, no resends.

## 2026-10-16 — Create Agent invitation audit (closed)
- [x] Counts reconciled: Oct 14 batch = 44 (17 Compass, 20 Corcoran Advisors, 1 Corcoran, 6 Gmail); 51 statuses = Oct 14–16 + Sep 22–Oct 9 window, 50 delivered (1 later temp bounce), 1 delayed
- [x] 2-day activation comparison: Aug 28 2/141 (1.4%), Sep 8 3/52 (5.8%), Oct 14 0/44 — zero plausible at low expected counts
- [x] All 44 Oct 14 links valid, unused, expire ~Nov 13; accounts eligible
- [x] No Compass/Corcoran delivery anomalies; no evidence bulk-by-domain caused issues (Aug 28 sent 141 at once incl. 8 Compass)
- [x] Recommendation: no tracking/pacing/template/queue changes; Chris checks with recipients personally
- [ ] ~Oct 22: read-only 7-day activation comparison of Oct 14 batch vs earlier batches at equivalent elapsed time, split by brokerage/domain. No code changes or emails; evaluate before deciding on improvements.

## 2026-10-17 — Create Agent invitation redesign (preview only)
- [x] Preview built (desktop/mobile, images on/off) in Files; live email untouched
- [x] Rebuild revised preview using established AAC dark masthead/footer and actual hosted command monogram; approved copy/photo/two buttons preserved, desktop/mobile images on/off visually verified; no production changes
- [ ] Chris approves design + copy → then edit live template, host hero image, deploy (no sends)
- [ ] Later phase: plain-text version (needs shared send-step change, separate approval)

- [x] 2026-10-21 Hot Sheet results Back follows path used; new-match email skips drafts (is_draft=false). Web change goes live via GitHub main.

## 2026-10-21 — Create Hot Sheet fix: live verification
- [x] Live click-through on allagentconnect.com (as Chris): 22 contacts selected in My Clients → Create Hot Sheet opened with "For a Buyer" visibly selected and all contacts listed; clicking "Personal — Just for Me" checked Personal, removed every contact, and none came back after waiting; closed without saving
- [x] Leftover "Untitled draft" from the test removed through the page's own Delete control; drafts back to 3 ("new test", "test new", "another test"), active still 21, zero emails queued during the test
- [ ] Personal view still shows the "Buyer emails" section ("How often matching listings are emailed to the buyer", "Also email me a copy") — waits for Chris's approval to hide it when Personal is selected
- [ ] Clicking "Personal — Just for Me" autosaves an "Untitled draft" at once — waits for Chris to say whether that is wanted or should wait until he types something

- [x] Comms emails for Chris: approved account-only Boston/Suffolk correction deployed 2026-10-22; single isolated test delivered. State-only matching is outside this approval.

## 2026-10-22 — Communications matching final impact review
- [x] Read-only named impact comparison completed: Chris + four others across 43 posts; Oct 20 adds only Chris and Walter. Shared patch is NOT safe to approve yet: seller-alert impact and split-event county-conflict bypass reproduced. Report: docs/audits/2026-10-22-comms-matching-impact.md.
- [x] Prepare Chris-only correction proposal and local no-send safeguards: 16 proposal checks + 11 existing assertions passed; report docs/audits/2026-10-22-comms-chris-only-proposal.md. No runtime edits, deployment, hosted send calls, preference changes or queue writes.
- [x] Implement approved exact UUID+email-gated Boston-only supplement locally and run no-send integration tests: 72 Deno tests passed; no hosted invokes, sends, queue writes or preference changes. No deployment.
- [x] Sender-copy count adjustment explicitly accepted by Chris on 2026-10-22; no additional copy is created.
- [x] Final requested delivery checks (2026-10-22): Chris unsubscribe RPC false for comms_broadcast/all, zero unsubscribe rows, complete provider suppression list excludes Chris; current project global and Communications pause gates are not active. No settings changes, sends, hosted broadcaster invocations or queue writes. Missing suppressed_emails needs no shared repair for this check.
- [x] Deploy Chris-only correction (explicitly approved 2026-10-22): send-client-need-notification deployment succeeded; exact UUID+email-gated adapter only. No other-agent expansion, preferences unchanged, no resends/backfills. Broader rollout requires separate approval.
- [x] Exactly one isolated controlled test delivered to chris@allagentconnect.com at 02:20:07 UTC on 2026-10-22; provider independently confirms delivered, no CC/BCC. One new email job, zero other-agent jobs; broadcast/digest/recipient counts unchanged. No normal broadcast created. Read-only hosted dry-run lacked an authenticated session; no extra access or send pursued. Future inclusion is supported by deployed adapter and 24 re-run passing account/integration safeguards (prior full suite 72 passed).
