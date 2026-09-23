# Success Hub Listing Activity: Off Market and Coming Soon only

## Goal

Listing Activity on the Success Hub shows only Off Market and Coming Soon listings, newest first by the date each listing was first added to AAC. Edits, price changes and status changes never move a card to the front. Nothing else in the app changes.

## What changes (one file: `src/components/success-hub/MarketActivityRow.tsx`)

1. **One eligibility rule.** A listing is shown only if its status is `off_market` or `coming_soon` AND `hidden_from_market_activity` is not true. The same rule runs on the first load, on new listings as they come in, and on listing updates.
2. **Order by date added.** Order newest first by `created_at` on the first load, in the on-screen sort, and after live updates. `updated_at` is no longer used to place cards.
3. **First load.** Swap the current "everything except draft/expired" filter for "status is off_market or coming_soon". Keep the existing `hidden_from_market_activity = false` filter.
4. **New listings (live).** Show only when the new row passes the rule. It takes its place by `created_at`.
5. **Listing updates (live).**
   - The listing is re-read and checked against the rule every time.
   - Still eligible: its card data (price, photos, details) is replaced where it is. Position stays the same because sorting is by `created_at`.
   - No longer eligible (Active, Pending, Under Contract, Sold, Withdrawn, Cancelled, Expired, Draft, any other status, or newly hidden): removed from the feed right away. Today, changes to draft/expired are ignored instead of removed; this fixes that.
   - Became eligible (for example, a draft published as Coming Soon): it joins the feed at the spot set by its original `created_at`, not the publish or status-change time.
   - Remove the check that skips updates unless certain fields changed. Every update gets re-read, so photo and detail edits also refresh the card and nothing is missed.

## What stays the same

- Sale / Rental toggle, Share Selected, 4-card layout, card design, header text and empty state.
- Listing search, listing detail pages, and My Listings.
- `hidden_from_market_activity`, including the existing exclusion for 31 Pacella Drive. Hidden listings stay hidden.
- Listing lifecycle, Hot Sheets, notifications, and emails. No database, backend or function changes, and nothing is deployed.

## Current data (read-only check)

- Coming Soon for sale: 17 shown, 2 hidden (stay hidden)
- Off Market for sale: 14 shown
- There are no Off Market or Coming Soon rentals today, so the Rental toggle will show the existing "No new market activity yet" message until one exists.

## Technical notes

- Add a local `MARKET_ACTIVITY_STATUSES = [LISTING_STATUS.OFF_MARKET, LISTING_STATUS.COMING_SOON]` from `@/constants/status` and an `isMarketActivityEligible(row)` helper (status in set && `hidden_from_market_activity !== true`).
- Initial query: `.in("status", MARKET_ACTIVITY_STATUSES)`, `.eq("hidden_from_market_activity", false)`, `.order("created_at", { ascending: false })`, same limit.
- `visibleListings` memo and the realtime upsert sort use `Date.parse(b.created_at) - Date.parse(a.created_at)`.
- INSERT handler: return early unless the payload passes `isMarketActivityEligible`, then re-read.
- UPDATE handler: always re-read by id (drop the `relevantChanged` gate and the early return on draft/expired). `upsertFromListingChange` removes the id if the re-read row is missing or fails `isMarketActivityEligible`; otherwise it replaces the row in place and re-sorts by `created_at`.
- `filterVisibleListings` is a pass-through today; the call stays as it is.
- After the edit, check the build log and review the feed in the preview. Then stop and report the changed file. No publish or deploy.
