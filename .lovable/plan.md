## Buyer/agent listing banner parity

Bring buyer-side `SearchListingCard` to behavioral parity with agent `ListingCard` for lifecycle photo banners. Parity only — no redesign.

### Banners covered
- Coming Soon (purple, sparkles)
- New Listing (black, sparkles)
- Back on Market (orange, refresh)
- Price Reduced (red, trending-down)
- Off Market (rose, refresh)
- Open House / Broker Open (with stacking behavior under status/price banners)

### Steps

1. **Create `src/hooks/useListingBanners.ts`** — extracts the existing agent-side logic verbatim:
   - Fetches `listing_status_history` (last 5, ordered by `changed_at` desc) keyed by `listing.id`.
   - Fetches `favorite_price_history` (last 1, ordered by `changed_at` desc) keyed by `listing.id`.
   - Applies the same 48-hour timing windows, status priority, `is_relisting` guard, off-market previous-status set, and open-house derivation.
   - Returns `{ statusBanner, priceChangeBanner, openHouseBanner }` matching the existing `BannerData` / `OpenHouseBannerData` shapes from `ListingCardShell`.

2. **Refactor `src/components/ListingCard.tsx`** to consume the hook. Pure extraction — no visual or behavioral change.

3. **Update `src/components/listing-search/SearchListingCard.tsx`** to consume the same hook and render the three overlays on the photo area using the same classes, priority (status > priceChange), and open-house stacking as `ListingCardShell`. Keep the existing `ListingStatusBadge` placement.

### Do not change
Banner text, colors, icons, timing windows, status rules, cron logic, DB schema, listing card layout, or `ListingCardShell` API (unless strictly required).

### Accepted inherited limitations (not fixed in this pass)
- Price reduction uses `favorite_price_history` (only lights up if at least one user favorited the listing).
- Status/price history fetch remains per-card (not batched).

### Verification
- Agent cards look and behave unchanged.
- Buyer cards now show Coming Soon, New Listing, Back on Market, Price Reduced, Off Market, and Open House/Broker Open with the same rules as agent cards.

### Files touched
- `src/hooks/useListingBanners.ts` (new)
- `src/components/ListingCard.tsx` (extraction only)
- `src/components/listing-search/SearchListingCard.tsx` (consume hook + render overlays)
