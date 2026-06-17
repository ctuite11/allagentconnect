## Fix Open House / Broker Tour icons

### Reference (from screenshot)
- Open House → 🎈 balloon
- Broker Tour → 🚙 car

### Current state
- Agent `ListingCardShell` photo overlay uses `🏢` (broker) and `🎈` (public).
- Agent `ListingCard` inline overlay uses the same emojis.
- Buyer `SearchListingCard` does not yet render an open-house photo overlay.

### Change
1. **`ListingCardShell.tsx`** — open-house photo overlay: replace `🏢` with `🚙` for broker tour. Keep `🎈` for public.
2. **`ListingCard.tsx`** — inline open-house photo overlay: same swap (`🏢` → `🚙`).
3. **`SearchListingCard.tsx`** — add the open-house photo overlay on both desktop and mobile photo areas:
   - `🚙 BROKER TOUR • MMM d • h:mm AM – h:mm PM` (purple) when `event_type = broker_tour`
   - `🎈 OPEN HOUSE • …` (green) otherwise
   - Stacks below the status/price banner (uses `top-5` / `top-6` like the shell)
4. **`useListingBanners.ts`** — change broker text from `"BROKER OPEN HOUSE"` to `"BROKER TOUR"` to match the screenshot label.

### Out of scope
- No change to colors (purple broker / green public stays).
- No change to status, price, or other lifecycle banners.
- No change to the existing green info pill below the photo on the buyer card.
- No change to icons used in other surfaces (utility strips, footers, etc.).

### Files touched
- `src/components/ListingCardShell.tsx`
- `src/components/ListingCard.tsx`
- `src/components/listing-search/SearchListingCard.tsx`
- `src/hooks/useListingBanners.ts`
