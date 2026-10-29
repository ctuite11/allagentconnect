# Approved items 1, 2 (frontend), 3 — plus investigation of 4 and 5

## Important: "test before deploying" and auto-deploy
Every saved change goes live on allagentconnect.com automatically (GitHub main → Netlify). That means I can't build a fix and hold it back for review. To meet your "present results before deploying" condition, each fix will be:
1. Tested with automatic checks and in the preview first.
2. Saved only after you OK that specific fix in chat.
Item 2 is first because it's the smallest change.

## Pre-checks already done (read-only)

**The 250k lookups come from the Success Hub. They are NOT background jobs. Confirmed in code.**
- Both lookups (the agent's name and photo, and "has a non-draft Hot Sheet") run together in the Success Hub setup checklist. That's why their counts match almost exactly (125,415 vs 125,412).
- The checklist re-checks itself after every screen update, because one of its inputs is recreated on every render. Each check updates the screen, which triggers another check. For agents who haven't finished setup, this loops non-stop while the Success Hub is open.
- The background job version (new-match notifications) is switched off, so it isn't the source.

**Photo resizing works. Tested on a real listing photo:**
- Original: 725 KB, 0.89 s.
- Resized for a card: 128 KB (82% smaller). First load 0.48 s, then 0.09 s once cached.
- Originals are currently sent with "don't cache", so browsers download them again on every visit. Resized versions avoid this.
- **Cost:** resizing is billed per unique original photo per month, not per view. I can't confirm the Lovable Cloud rate from here. I'll check the usage page with you before switching on, and can start with listing detail pages only if you want to limit exposure.

## Item 2 — Fix the checklist loop (frontend only)
- Make the checklist check once per visit, plus again after a step is completed. It will no longer run on every screen update.
- The checklist behaves the same: same steps, same dismiss rules.
- Add a test that fails if the check runs more than once per visit.
- **Before/after counts:** record the two query counts now, then again 24 hours after the change. The query statistics can't be reset without a database change, so I'll compare the growth over 24 hours.

## Item 1 — Resized listing photos (frontend only)
- One shared helper turns a photo link into a resized link. Cards use about 600px wide (800px on sharp screens), the detail page uses about 1400px, and quality is about 80.
- Photos that aren't in storage (outside links, older formats) pass through unchanged. If a resized image fails, it falls back to the original.
- Applies to: listing cards, Hot Sheet cards, Success Hub cards, and the listing detail main photo and gallery.
- Full-size originals stay in place for full-screen photo viewing and downloads.
- Add width/height to listing photos, and mark the detail page's first photo high priority (everything else keeps lazy loading).
- Untouched: uploads, stored photo links, publishing, Hot Sheet matching, emails, social previews.
- Tests: the helper's link rules, plus checking in the preview that existing listings still show photos.

## Item 3 — Success Hub check
- Browser-test going to the Success Hub and back from Hot Sheets and listing pages, timing each trip and counting requests.
- **About 5 minutes vs 60 seconds:** the 5 minutes I reported is the app-wide default. I haven't yet confirmed whether the Success Hub sets its own 60-second value. This pass checks that and reports the real number. I'll only change it with your approval.
- Check that editing a listing or Hot Sheet refreshes the Success Hub. No automatic refresh triggers exist in the app today, so this may be a real gap. I'll report it before fixing anything.

## Item 4 — Rolled-back transactions (investigation only)
- The 10,669 total is a running count, not a list. I'll compare snapshots over time to see the rate, and look at the database logs to find which work is being cancelled.
- I'll sort it into three groups: actual failures, expected behaviour (for example, the job-claiming step skipping locked rows), and repeated retries. No database changes.

## Item 5 — Tiny vs Mini (advice only)
- Right now: memory at 59%, 21 of 60 connections, and the last speed alert on Oct 27 at 43% budget left. That's not an emergency at this moment.
- But each of the three outages hit the same disk-speed limit, and the checklist loop is probably a meaningful share of that load.
- **Advice:** fix the loop, watch the alerts for 48 hours, then decide. If another disk-speed alert below 20% appears before migration, upgrade.

## Not touched
Email, background job timing, database structure, sign-in, account settings. No emails or notifications.
