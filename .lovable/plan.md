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
