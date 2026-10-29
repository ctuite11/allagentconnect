# Performance investigation (Oct 27–28) — findings and proposed fixes

Read-only. Nothing changed, sent or rescheduled.

## Confirmed findings

**Listing photos**
- Listing cards, Hot Sheet cards and Success Hub cards load the full original upload straight from storage (`/object/public/...`). No resized version is requested, so a phone downloads the same multi-megabyte photo as a desktop for a 192px-tall card.
- Resized image delivery is only used for social preview images and emails, never on screen.
- Photos have no width/height set, so the page can't reserve space, and only the homepage photo is marked high priority. The main photo on a listing detail page isn't.

**Backend**
- The database is up now: memory at 59%, disk 7% full, 21 of 60 connections in use, no restarts.
- The last disk read/write speed alert was **Oct 27, 2:44 PM ET (43% budget left)**. This matches the pattern behind the Oct 6, Oct 21 and Oct 27 outages on the smallest (Tiny) size.
- Two very small lookups run about **125,000 times each** since the last restart: an agent's name and photo by ID, and "does this agent have non-draft Hot Sheets". Each one is fast, but together they are the biggest share of database work.
- Five background jobs run **every minute**: Hot Sheet events, email queue, listing status updates, the capacity sampler, plus the auth-deletion job every 10 minutes and digests every 15 minutes.
- Smaller items: online "heartbeat" every 2 minutes per open tab, and "last seen" updates averaging 52 ms (up to 360 ms). The verified-agents list takes up to 360 ms per call.
- 10,669 rolled-back transactions since boot (a sign of repeated failed or retried work).

**Success Hub**
- Global caching is on (5-minute freshness), and the Success Hub uses it.

## Suspected (not yet proven)
- The 125k lookups probably come from per-row work inside the every-minute background jobs, or from many cards each fetching their agent separately. The exact source needs to be traced.
- The slowest photo loads (P90 4.8 s, P99 9.4 s) are most likely full-size photos on mobile connections. I couldn't match individual Cloudflare spikes to database timestamps, because the stats reset at the last restart.
- Back-navigation to the Success Hub wasn't tested in a browser in this pass.

## Recommended fixes, ranked

1. **Serve resized listing photos** (biggest effect on page load, safe now). Use the existing resize helper for card-sized (about 600px) and detail-sized (about 1400px) images. Add width/height, and mark the first photo on a detail page high priority. Frontend only.
2. **Stop the repeated agent/Hot Sheet lookups** (high, safe now). Fetch them once per page or batch, and cache them. Frontend first; trace any background-job source before touching it.
3. **Database size: Mini** (urgent stability, about +18.6 credits/month). Needs your separate approval. It doesn't change any code.
4. **Fewer every-minute jobs** (high, wait until after migration). For example, run listing status checks every 5 minutes. This changes timing, so it needs approval.
5. **Slower heartbeat / last-seen** (medium). Every 5 minutes, and only when the tab is visible. Safe now.
6. **Success Hub check** (medium). Browser-test the back navigation and count requests per visit. Fix only if it's still slow.
7. **Find the cause of the rolled-back transactions; index the verified-agents list** (medium, after migration).

## Before vs after migration
- **Before:** items 1, 2 (frontend part), 5, 6. These are frontend changes and are easy to undo.
- **After:** items 4 and 7, plus anything touching background jobs or the database. Item 3 can go either way. If the new host's size is set during migration, Mini may not be needed.

## Next step
Approve the items you want, and I'll implement them one at a time with tests. Nothing goes live without your OK.
