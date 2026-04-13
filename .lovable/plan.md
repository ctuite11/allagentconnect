

# DCMLS Product Surface — Badge, Filter, Homepage Section

## Overview

Wire up the existing DCMLS publish system into visible UI across three surfaces: a badge on listing cards, a search filter toggle, and a homepage exclusive listings section.

## 1. DCMLS Badge on Listing Cards

**Files**: `ListingCard.tsx`, `SearchListingCard.tsx`, `ListingCardShell.tsx`

Add a small green pill badge ("DCMLS") positioned top-left over the photo area when:
```ts
listing.publish_to_dcmls === true && listing.dcmls_status === "published"
```

- **ListingCardShell** (used by ListingCard in list mode): Add optional `publish_to_dcmls` and `dcmls_status` to `ShellListingData` interface. Render badge over photo slot.
- **ListingCard** (grid/compact modes): Add badge in the photo container for grid and compact view modes. Pass DCMLS fields through.
- **SearchListingCard**: Add `publish_to_dcmls` and `dcmls_status` to `SearchListing` interface. Render badge over photo in both desktop and mobile layouts.
- Badge style: `bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full absolute top-2 left-2 z-10`
- Show nothing when false.

## 2. DCMLS Filter Toggle in Search

**Files**: `ListingSearchFilters.tsx`, `ListingSearch.tsx`

- Add `dcmlsOnly: boolean` to `FilterState` interface (default `false`)
- Add to `initialFilters`: `dcmlsOnly: false`
- In the filter UI, add a switch/toggle in the primary filter row (near the top, same level as property type/status):
  - Label: "DCMLS Only"
  - Uses the `Switch` component
- In `ListingSearch.tsx`, pass `filters.dcmlsOnly` into the query builder's `dcmlsOnly` field (already supported by `buildListingsQuery.ts`)

## 3. Consumer Homepage — Exclusive Listings Section

**File**: New component `DcmlsExclusiveListings.tsx`, update `ConsumerHome.tsx`

- Create `src/components/DcmlsExclusiveListings.tsx`:
  - Query `listings` table with `applyDcmlsFilter`, order by `created_at desc`, limit 6
  - Render as a responsive grid of simplified listing cards (photo, price, address, beds/baths/sqft)
  - Title: "Homes You Won't Find Anywhere Else"
  - Subtitle: "Exclusive listings from our agent network"
- In `ConsumerHome.tsx`, add this section between Featured Properties and the Ad Banner

## 4. No Other Changes

- No schema changes needed (columns already exist)
- No storage/photo migration work
- No draft badges or extra labels
- Keep it clean and premium

## Files Changed

| File | Change |
|------|--------|
| `src/components/ListingCard.tsx` | Add DCMLS badge in grid/compact photo area |
| `src/components/ListingCardShell.tsx` | Add DCMLS badge over photo, extend interface |
| `src/components/listing-search/SearchListingCard.tsx` | Add DCMLS badge, extend interface |
| `src/components/listing-search/ListingSearchFilters.tsx` | Add `dcmlsOnly` to FilterState + Switch toggle |
| `src/pages/ListingSearch.tsx` | Pass `dcmlsOnly` to query builder |
| `src/components/DcmlsExclusiveListings.tsx` | New — homepage exclusive listings grid |
| `src/pages/ConsumerHome.tsx` | Add DcmlsExclusiveListings section |

