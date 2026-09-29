# Listing results card address QA

## Verified current paths
- The standard list-row results use `SearchListingCard`, and both its wide and compact layouts render addresses through `ListingCardAddressLine`.
- `ListingCardAddressLine` formats its text with the shared `buildDisplayAddress()` helper.
- The default map/results grid uses the shared compact `ListingCard`, whose address lines also use `ListingCardAddressLine`.
- The current preview build is healthy.

## QA
- Open an authenticated Listing Search results screen containing 4 Derne St #1.
- Verify its visible card address is exactly `4 Derne St #1, Boston, MA 02114`.
- Check both result modes:
  - desktop list-row view
  - compact/mobile card view
- Confirm the displayed address retains uppercase `MA`, uses `St`, includes `#1`, and does not repeat city, state, or ZIP.
- Spot-check another visible result for the same address grammar and confirm the layout remains intact.

## Conditional fix only
- If any results-card surface bypasses the shared path or displays different grammar, replace only that address output with the existing `ListingCardAddressLine` or shared listing-address helper.
- Do not add another formatter, redesign cards, alter stored listing data, or change search behavior.
- Recheck both layouts after any necessary correction and confirm the build remains healthy.
