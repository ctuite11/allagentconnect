## Fix sticky search toolbar overlap on mobile

The Listing Search toolbar (For Sale/Rent toggle, Reset, filter chips, results count, View Results) lays out as a single non-wrapping flex row. On narrow phone widths the trailing chips ("For Sale", "8 statuses", "6 results") collide with the controls on the right.

### Change

In `src/pages/ListingSearch.tsx` (sticky toolbar block around lines 217–311):

1. Allow the row to wrap:
   - `flex items-center gap-3` → `flex flex-wrap items-center gap-2 sm:gap-3`
   - Tighten horizontal padding on mobile: `px-5 py-3` → `px-4 sm:px-5 py-3`

2. Push the active filter chips onto their own line on mobile, keep inline on ≥sm:
   - Chips container: `flex items-center gap-2 flex-wrap flex-1 min-w-0` → `flex items-center gap-2 flex-wrap min-w-0 w-full order-last sm:order-none sm:flex-1 sm:w-auto`

3. Keep the results count + View Results pinned right on the first row:
   - Add `ml-auto` to the results/CTA group so it stays flush right when wrapping.

No behavior, data, or component-structure changes — purely responsive layout tokens.
