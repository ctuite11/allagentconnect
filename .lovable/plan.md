## Completed Changes

### 1. Add Expired to My Listings filters
- Added `"expired"` to `PIPELINE_STATUSES` and `ListingStatus` type in `MyListings.tsx`
- Expired now appears in filter tabs and is searchable

### 2. "Save Changes" → "Publish" for draft edits
- `AddListing.tsx`: Both desktop and mobile save buttons now show "Publish" with Upload icon when original status is draft and current status is non-draft; "Save Draft" when status remains draft
- `EditListing.tsx`: Same logic applied to save button label

### 3. Price range display for Coming Soon / Off Market
- `ListingCard.tsx`: Added `price_range_min` / `price_range_max` to interface; `displayPrice` falls back to range when price is 0/null
- `PropertyDetail.tsx`: Added range fields to interface; price display falls back to range

### 4. Relabel "Private" → "Off Market"
- `status.ts`: All 6 instances of "Private", "Off-Market", "Off-Market (Private)" normalized to "Off Market"
- `MyListings.tsx`: Removed hardcoded "Private" override, now uses centralized label

### 5. Auto-revert Back on Market → Active after 48 hours
- `supabase/functions/update-listing-statuses/index.ts`: Added Part 4 logic
- Queries listings with `status = 'back_on_market'`
- Finds latest `listing_status_history` row where `new_status = 'back_on_market'`
- If `created_at` is older than 48 hours, reverts to `active` with `.eq('status', 'back_on_market')` guard
- Logs transition in `listing_status_history` with system note
- Response payload includes `back_on_market_reverted` with count and IDs
- No migration needed; UI badge in ListingCard is history-driven (14-day window) and unaffected

### 6. Status-aware Hot Sheet alerts for Back on Market → Active
- **`hot_sheet_sent_listings`**: Added `status_at_send text NOT NULL` column; backfilled from listings; replaced unique index `(hot_sheet_id, listing_id)` → `(hot_sheet_id, listing_id, status_at_send)` — allows same listing to be sent under different statuses
- **`check_hot_sheet_matches`**: Added `back_on_market` to default pipeline statuses; added status-criteria matching (respects `criteria->'statuses'` when set); dedup now checks `status_at_send = l.status`
- **`notify_matching_buyers_on_new_listing` trigger**: Changed from `AFTER INSERT` to `AFTER INSERT OR UPDATE`; fires for `active` and `back_on_market`; guards against unchanged status on UPDATE
- **`process-hot-sheet/index.ts`**: Added `back_on_market` to default status filter; writes `status_at_send` when recording sent listings
- **`send-new-match-notification/index.ts`**: Fetches listing statuses and writes `status_at_send` on upsert; updated onConflict to include `status_at_send`

### 7. Duplicate Listing Detection
- **`src/lib/checkDuplicateListing.ts`** (new): Reusable helper that queries `listings` for matching normalized address+city+state+zip in blocking statuses (`active`, `new`, `coming_soon`, `off_market`, `back_on_market`, `price_changed`, `extended`, `reactivated`, `under_agreement`, `pending`, `contingent`). Normalizes via trim + lowercase + collapse spaces. Excludes self via `excludeListingId` param for edit mode. `isLiveStatus()` helper determines when to run the check.
- **`AddListing.tsx`**: Duplicate check wired into both `handleSaveChanges` (after validation, before file uploads) and `handleSubmit` (after Zod validation, before file uploads). Only runs when target status is a live/published status. Excludes `listingId || draftId` in edit mode.
- **`AddRentalListing.tsx`**: Same duplicate check wired into `handleSubmit` after Zod validation, before file uploads. Only runs for live statuses.

### 8. Database-Level Duplicate Listing Protection
- Added `address_normalized` column to `listings` table
- Created `BEFORE INSERT OR UPDATE` trigger to auto-populate via `lower(trim(regexp_replace(...)))`
- Created partial unique index `listings_unique_live_address` on `(address_normalized, city, state, zip_code)` for live statuses only
- Backfilled all existing rows

### 9. Stronger Address Normalization (MLS-Grade)
- **`normalize_listing_address_text(input text)`** (new SQL function): Deterministic normalization with street suffix mapping (street→st, avenue→ave, etc.), unit marker normalization (apt/suite/#→unit), punctuation stripping, word-boundary-aware regex (`\y`), NULL/empty safety
- **`normalize_listing_address()` trigger**: Updated to call `normalize_listing_address_text()` instead of inline logic
- **Backfill**: All existing `address_normalized` values recalculated with stronger normalization
- No frontend or index changes

### 10. AppShell + Sidebar Navigation (Phase 1)
- Created `src/components/layout/AppShell.tsx` with collapsible sidebar + compact header
- Created `src/components/layout/SidebarNavigation.tsx` with grouped nav links
- Wrapped all authenticated agent/admin routes in `AgentLayout` → `AppShell`
- Public, auth, consumer, and legal pages remain outside the shell
- Fixed Navigation.tsx prefix-based hiding to use specific sub-paths (not broad `/agent/`)

### 11. ListingCardShell — Canonical Horizontal Card (Phase 2)
- Created `src/components/ListingCardShell.tsx` as single visual source of truth for desktop list-view listing cards
- Refactored `ListingCard.tsx` to use shell for `list` viewMode
- Refactored `SearchListingCard.tsx` to use shell for desktop view
- Deleted `ListingResultCard.tsx` (537 lines, zero external imports — confirmed dead code)

#### Listing Surface Classification
| Surface | Component | Card Class |
|---|---|---|
| My Listings | ListingCard (list mode) | canonical horizontal via shell |
| Listing Search / Results | SearchListingCard → shell | canonical horizontal via shell |
| Agent Dashboard | ListingCard (list mode) | canonical horizontal via shell |
| Hot Sheet Review | ListingCard (list mode) | canonical horizontal via shell |
| Browse Properties | ListingCard (compact/grid) | intentional grid card |
| Search Results (consumer) | ListingCard (compact/grid) | intentional grid card |
| IDX Search | IDXListingCard | IDX-specific separate system |

Rule: ListingCardShell is the single source of truth for all desktop horizontal listing cards. Grid mode and IDX remain intentionally separate.

### 12. Buyer HotSheets Collections Page (Compass-inspired)
- **`src/pages/HotSheets.tsx`**: Full rewrite — groups hot sheets by client into `BuyerCollection[]`, responsive 3-col grid, fetches listing photos from `hot_sheet_sent_listings → listings` for mosaic
- **`src/components/BuyerCollectionCard.tsx`** (new): Compass Collections-style card with 2x2 image mosaic, client name, hot sheet count, participant row (agent + client + up to 2 collaborators + overflow)
- Card click: single hot sheet → `/hot-sheets/:id/review`; multiple → `/hot-sheets/buyer/:clientId`
- Existing dialogs (create, edit, share, comments) preserved
