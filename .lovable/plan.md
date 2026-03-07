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
