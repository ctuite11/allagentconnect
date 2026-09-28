# My Listings: show every status, search on its own row

## Why some statuses are missing now
There's no technical reason. The page uses one short, hand-written list of statuses for three jobs: loading listings, the filter buttons, and the quick status editor on each card. Code comments say the list was kept small on purpose so the quick editor stays simple, and Back on Market was hidden inside "On MLS". Nothing in the database or the rest of the system needs Under Agreement, Pending, Contingent, Sold, Rented, Price Change, Extended or Reactivated left out of My Listings.

## Changes (My Listings page only)
1. **Load everything**: load the agent's listings in all 17 approved statuses. Plain Withdrawn stays out.
2. **Filter buttons**: show all 17 statuses in this order: On MLS, New, Coming Soon, Off Market, Back on Market, Price Change, Extended, Reactivated, Under Agreement, Pending, Contingent, Sold, Rented, Temporarily Withdrawn, Cancelled, Expired, Draft. Names come from the app's existing status list, so there's no second copy.
3. **Back on Market gets its own button**: it's no longer counted as On MLS.
4. **Toolbar layout**: row 1 has Sale / Rental, the status buttons (they wrap onto another line on narrow screens), then Sort at the end. The "Search address, MLS #…" box moves to its own full-width row below.
5. **Card actions stay the same**: Edit, Photos, Open House, Broker Tour, Matches, Email, Social, Views, Saves, Stats. No Share button.
6. **Quick status editor stays the same**: it keeps its current short list. If a listing is in a status the editor doesn't offer (for example Sold), the editor shows that status as it is and doesn't quietly change it to On MLS.

## Not changing
What each status means, Add/Edit Listing status behaviour, Hot Sheets, emails, social posting, DCMLS, and anything in the database.

## Technical details
- `src/pages/MyListings.tsx` only. Split the current list into `FILTER_STATUSES` (built from `LISTING_STATUS`, leaving out `WITHDRAWN` and the `CANCELED` alias; used for the query and the filter buttons) and `EDITABLE_STATUSES` (the current 8, used for the quick editor).
- Widen the local `ListingStatus` type. Remove the back_on_market-to-active mapping from the filter (line ~513). Also update the editor setup (line ~557) so a status not in the editable list is shown read-only instead of being swapped for another status.
- Keep the existing Draft default-hiding rule. Keep `?status=` URL values working.
- Heads-up: saving to GitHub main makes this live on allagentconnect.com right away.
