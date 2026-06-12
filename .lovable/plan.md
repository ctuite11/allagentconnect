## Goal
Make off-market listings visible to everyone in search results (agents, buyers, and public visitors), same as active listings.

## Current behavior
`src/lib/filterVisibleListings.ts` enforces: off-market listings are only returned when the viewer is the owning agent. This filter is applied in `ListingSearch.tsx` and `ListingSearchResults.tsx` after the DB query returns.

The existing RLS policy (memory: "Listing visibility RLS policy") already permits visibility of all published listings, so removing the client-side filter is sufficient — no migration required.

## Changes

1. **`src/lib/filterVisibleListings.ts`** — Change the filter so it no longer hides off-market from non-owners. Simplest path: make it a pass-through (return listings as-is) and add a comment that off-market is publicly visible. Keep the function signature so existing call sites stay valid.

2. **Verify** no other gate hides off-market:
   - `ListingSearchResults.tsx` line 200 (`internalFilter === "off_market"`) is an explicit opt-in filter, unrelated — leave it.
   - RLS already allows public reads of published listings (off-market is a published status).

## Out of scope
- No RLS/migration changes.
- No UI changes to badges, cards, or filter chips.
- Off-market still excluded from the default status set (`active` + `coming_soon`) unless the user explicitly selects it via the status filter — that's existing behavior and you didn't ask to change defaults. If you also want off-market shown by default, say so and I'll add it to the default `statuses` array in `buildListingsQuery.ts` and the URL-param defaults.
