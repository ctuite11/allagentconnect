I found the listing: `28-32 ATLANTIC AVE` still exists in the database, but it was automatically changed from `active` to `expired` at midnight because its `expiration_date` is `2026-04-30`. That is why it disappeared from active/search views.

Plan:

1. Restore the listing visibility
   - Update `28-32 ATLANTIC AVE` from `expired` back to `active`.
   - Extend or clear its `expiration_date` so the scheduled status job does not immediately expire it again.
   - Add a status-history entry noting it was restored after unintended auto-expiration.

2. Prevent this specific issue from recurring
   - Review the scheduled `update-listing-statuses` behavior for expiration dates.
   - Adjust the auto-expiration condition if needed so listings do not disappear unexpectedly on the expiration date without an intentional post-expiration window.
   - Keep the existing lifecycle system intact; no schema redesign.

3. Fix the current build error surfaced during inspection
   - `src/pages/BuyerMapSearch.tsx` is passing listings into `ListingCard`, but TypeScript says `status` may be missing.
   - Normalize/hydrate the listing data so each record passed to `ListingCard` includes `status`, without changing UI layout.

4. Verify
   - Confirm the database row for `28-32 ATLANTIC AVE` is active again.
   - Confirm it appears in active listing/search queries.
   - Confirm the TypeScript build error is resolved by the code change.