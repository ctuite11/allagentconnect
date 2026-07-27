## Goal (mobile only, ≤ sm)

Property Detail page on phones should read:

1. **Price** — left-aligned, directly above the photo (tight spacing).
2. **Photo** (unchanged).
3. **Address** — moved to sit directly **above** the Property Type / beds / baths facts row.
4. **Facts row** — Property Type, beds, baths, sqft, parking, DOM must **wrap to two lines**, no horizontal scroll.

Desktop (≥ lg) layout stays exactly as it is today (address left + price right above the photo, single-line facts row).

## Changes

### 1. `src/pages/PropertyDetail.tsx` (Row 1 + facts area)
- Replace the `<PropertyHeader embedded … />` (Row 1) with a mobile/desktop split:
  - **Mobile (`lg:hidden`)**: render just the **price** (left-aligned), reusing `propertyPriceText`, in the same slot above the photo. Tighten `mb-*` so the gap under it is small.
  - **Desktop (`hidden lg:block`)**: keep the existing `<PropertyHeader embedded …>` with address + price side-by-side.
- Directly above `<PropertyFactsRow …>` (around line 755), add a mobile-only address block (`lg:hidden`) that renders the `MapPin` + formatted address using the existing `propertyAddressH1` token (or a slightly smaller mobile variant) so styling matches the current address treatment.

### 2. `src/components/property/PropertyFactsRow.tsx`
- Change the inner row classes from `flex-nowrap … overflow-x-auto [&::-webkit-scrollbar]:hidden` to `flex-wrap … lg:flex-nowrap` (and drop the horizontal-scroll classes on mobile). Result: facts wrap onto two rows on narrow screens; desktop still lays out on one row.
- Keep `gap-x-4 sm:gap-x-9 gap-y-2.5` — the existing `gap-y-2.5` already handles the two-row spacing.

## Out of scope
- `ConsumerPropertyDetail.tsx` and any shared token defaults — no changes.
- Desktop layout, typography sizes, back button, badge, share/photos buttons — unchanged.
- Business logic — none touched.

## Verification
- Load `/property/L-1223` at 384px viewport (mobile preview) and confirm: price sits tight above the photo on the left; address sits directly above the "Property Type: …" line; all six fact chips are visible without horizontal scroll on two rows.
- Load at desktop width and confirm header + facts row look identical to today.
