# Remove Sticky Behavior from Listing Search Results Header

## Goal
On `/listing-results` (Listing Search results), the top controls (Back, Edit search, Results count, Map/List toggle, Select all, Save as Hot Sheet, Sort) currently stay fixed at the top while listings scroll underneath. Remove the sticky positioning so the whole section scrolls offscreen naturally with the page.

## Current state (verified)
- `src/pages/ListingSearchResults.tsx` line 531 — the results toolbar wrapper is `className="sticky top-0 z-20 border-b border-neutral-200 bg-white px-3 sm:px-4 lg:px-5"`. This is the only sticky element on the results page.
- In map-split view the equivalent header (line 538) is already non-sticky — no change needed there.
- Open House / Broker Tour event bars (`ListingPhotoBanners`, `SearchListingCard`, `ListingCardShell`, `ListingCard`) contain **no** sticky positioning anywhere — they render inside individual listing cards and cannot become sticky. No change needed; verified read-only.
- The search entry page (`/listing-search`, `ListingSearch.tsx` line 234) has its own sticky criteria card — out of scope (user asked only for the results controls; strict scope adherence).

## Change
1. In `src/pages/ListingSearchResults.tsx`, line 531, change the toolbar wrapper class from
   `sticky top-0 z-20 border-b ...` to `border-b ...` (remove only `sticky top-0 z-20`; keep border, background, and padding so appearance is unchanged while scrolling).
2. Nothing else. No changes to search behavior, Hot Sheets, selection, sorting, listing data, events, or global navigation.

## Verification
- Type-check and build pass.
- Preview (signed in as Chris): open Listing Search results, confirm the toolbar (Back / Edit search / count / Map-List / Select all / Save as Hot Sheet / Sort) scrolls away with the page and listings use the full viewport; confirm an Open House / Broker Tour bar scrolls with its listing card and never pins to the top.
- No deploy unless Chris asks; production goes via GitHub main → Netlify as usual.
