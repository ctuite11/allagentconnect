## Problem

On the Agent Profile page, clicking a listing card opens `/property/:id` with no navigation state. `PropertyDetail`'s Back handler falls back to `/listing-results` (Edit Search) for agents/admins when no `location.state.from` is provided — so Back sends the user to search instead of back to the agent profile.

`PropertyDetail.handlePropertyDetailBack` already honors `location.state.from` first, so the fix is just to have Agent Profile pass that state, the same way search results and other surfaces do.

## Fix (frontend only, one file)

**`src/pages/AgentProfile.tsx`** — in the Listings section, pass the current profile path as return-state to `ListingCard`:

- Add `useLocation()` from react-router-dom.
- On each `<ListingCard>` rendered in the listings grid, add:
  ```
  compactDetailNavigateState={{ from: location.pathname + location.search }}
  ```

`ListingCard`'s compact view already forwards `compactDetailNavigateState` into `navigate(detailPath, { state })`, and `PropertyDetail` will then Back to the agent profile URL.

## Out of scope

- No changes to `PropertyDetail`, `ListingCard`, `backTargets`, or route config.
- No changes to consumer/public/buyer variants.
- No behavior change for listings opened from any other surface (search, hot sheets, my listings, etc.).

## Verification

1. From an agent profile (`/agent/:idOrCode` or `/agents/:id`), click a listing card → land on `/property/:id`.
2. Click Back → returns to the same agent profile URL (path + query preserved).
3. Opening the same listing from Listing Search still returns to search results (unchanged).