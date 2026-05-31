## Label cleanup: remove "New" from Add Listing dropdowns

### Files
- `src/constants/status.ts`
- `src/pages/AddListing.tsx`

### Changes

**`src/constants/status.ts`**
- `ADD_LISTING_CREATE_STATUSES`: remove the `NEW` entry; replace with `{ value: LISTING_STATUS.ACTIVE, label: "On MLS" }`. Final order: Off Market, Coming Soon, On MLS.
- `ADD_LISTING_EDIT_STATUSES`: remove the `NEW` entry entirely. `ACTIVE` (labeled "On MLS") remains.

**`src/pages/AddListing.tsx`** (line ~3444)
- Helper text: "…automatically change the status from Coming Soon to **Active**." → "…to **On MLS**."

### Out of scope
DB values, schema, RLS, cron/edge functions (`update-listing-statuses`, `auto_activate_on`, `go_live_date`), business logic, non-listing "active" labels. `active` remains the stored backend value.

### Verify
- Create dropdown shows: Off Market, Coming Soon, On MLS
- Edit dropdown shows On MLS, no New
- Helper text reads "to On MLS"
- Existing `active` listings render as "On MLS"
