# Hot Sheet check on the two Listing Activity cards

## What I confirmed

Both cards in the screenshot are live `coming_soon` listings — the two drafts I looked at first (106 Harrishof, 6 Judson) were the wrong ones.

| Listing | Published (draft -> coming_soon) | Hot Sheet alert to you |
|---|---|---|
| 23 Burnham St, Somerville — $1,395,000 | Aug 14, 01:23 UTC | Yes. Job `5faecc7d`, "New matches in your Hot Sheet: boston", delivered to chris@allagentconnect.com |
| 44 Ashwood Ave, Wilmington — $1,299,000 | Aug 14, 18:37 UTC | No. No `hot_sheet_sent_listings` row, no `email_jobs` row |

Your "boston" hot sheet (`044322c7`) is active with statewide MA criteria — no city, price, bed, bath, or property-type limits, and `coming_soon` is in its status list. 44 Ashwood (MA, Middlesex, single family, $1,299,000, not hidden, 10 photos) satisfies every criterion, and the sibling Burnham listing published 17 hours earlier through the same path did send. So this looks like a genuine missed alert, not a filter exclusion.

## Diagnosis status: unconfirmed

The dispatch chain is `notify_matching_buyers_trigger` -> `dispatch_hot_sheet_listing` -> `net.http_post` to `notify-matching-buyers` -> `send-new-match-notification`. Every step in that chain swallows failures into a `RAISE WARNING` and returns, so a silent drop is possible at the vault-secret lookup, the HTTP post, or inside either edge function. `net._http_response` no longer retains Aug 14 rows, so I cannot name the failing step from the data alone.

## Plan

1. Pull `notify-matching-buyers` and `send-new-match-notification` edge function logs for Aug 14 18:37–18:40 UTC to see whether the request arrived and what it decided.
2. If logs are gone, re-run the matcher for listing `e5f05daf` in dry-run/enqueue-inspection mode only — compute which hot sheets it matches without writing `email_jobs` or `hot_sheet_sent_listings` — to see whether the matcher excludes it.
3. Report the exact failing step and propose the targeted fix.

## Safety constraints

- No resend, retry, backfill, or catch-up email for 44 Ashwood or any other listing.
- No re-enqueue of `email_jobs` rows.
- Read-only and dry-run only; any actual send or code change comes back for separate approval.
