# Success Hub Listing Activity: Off Market and Coming Soon only

## What changes

The Listing Activity section on the Success Hub dashboard will show only listings with a status of **Off Market** or **Coming Soon**.

- **Order:** newest first, by the date the listing was added to AAC. Edits, price changes, and status changes do not move a listing to the front.
- **Price changes:** if an Off Market or Coming Soon listing in the feed changes price, its card shows the new price right away. Its place in the list stays the same.
- **Status changes:** when a listing goes Active, Pending, Sold, Withdrawn, Cancelled, or anything other than Off Market or Coming Soon, it leaves Listing Activity. It stays in listing search and on its detail page.
- **New listings:** a new Off Market or Coming Soon listing, or a draft published as one, appears in its place by date added.
- The Sale/Rental toggle, Share selected, the 4-card layout, and listings already hidden from this feed (such as 31 Pacella Drive) work the same as before.

## What stays untouched

- Listing search, listing detail pages, My Listings, Hot Sheets, and all emails.
- No listing data, statuses, or database changes.
- No design changes to the section or its cards.

## Current effect (from live data)

The feed currently pulls in 19 Active sale listings and 6 Active rentals. It also includes one Temporarily Withdrawn and one Cancelled listing. All of these drop out. There are 14 Off Market and 19 Coming Soon sale listings, minus the ones already hidden. No Off Market or Coming Soon rentals exist today, so the Rental view will show its empty message until one is added.

## Verification

- Open the Success Hub and confirm only Off Market and Coming Soon cards appear, newest-added first.
- Confirm an Active listing (e.g. 242 Lexington Road) no longer appears in Listing Activity but still shows in listing search.

## Technical notes

File: `src/components/success-hub/MarketActivityRow.tsx` only.

- Initial query: replace `.not("status","in","(draft,expired)")` with `.in("status", ["off_market","coming_soon"])`, and order by `created_at` desc instead of `updated_at`. Keep `hidden_from_market_activity = false`.
- Client sort in `visibleListings` and in the realtime upsert: sort by `created_at` desc.
- Realtime INSERT: accept only `off_market` / `coming_soon` rows.
- Realtime UPDATE: if the new status is not `off_market` / `coming_soon`, or the hidden flag is on, remove the row from the pool. Otherwise, on a status/price/type change, re-fetch and upsert in place, ordered by `created_at`.
- Add a small shared constant `MARKET_ACTIVITY_STATUSES = ["off_market","coming_soon"]` in the file, used by all three paths.
