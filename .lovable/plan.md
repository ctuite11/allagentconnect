# Fix Open House / Broker Tour dates showing one day early

## Cause
Dates are saved correctly as plain calendar days (e.g. `2026-10-15`). Some screens turn that into a midnight-UTC time, so in Eastern Time it shows as the day before (Oct 14).

## Screens affected (confirmed in code)
- Scheduled Open Houses & Broker Tours popup (`ViewOpenHousesDialog.tsx`)
- My Listings inline Open House / Broker Tour line (`MyListings.tsx`, `formatOpenHouseEvent`)
- Listing photo banners "OPEN: Oct 15 ..." on listing cards (`useListingBanners.ts`)
- Search result cards "Open House: Oct 15" / "OH: Oct 15" (`SearchListingCard.tsx`)

## Change (display only)
1. Add one small helper `parseDateOnly("YYYY-MM-DD")` in `src/lib/utils.ts` that builds a local calendar date from year/month/day.
2. Use it in the four places above for the displayed date and for sorting by date. Lines already using `date + "T" + time` (upcoming/expired checks) are already correct and stay as-is.
3. Add a unit test showing `2026-10-15` formats as Thu, Oct 15, 2026.

## Unchanged
Saved data (no migration; stored values are correct), saving logic, statuses, publishing, Hot Sheets, emails.

## QA
On a test listing, save a Broker Tour and a Public Open House for Oct 15, 2026, 11:30 AM–1:30 PM. Confirm every screen shows Thu, Oct 15.
