## Audit result

The buyer "For Rent" search returns 0 listings, so the results list is empty and the map shows the empty state. Verified in the database:

- Existing rentals (`listing_type = 'for_rent'`) have `property_type` values `condo` and `apartment`.
- Buyer rental search hard-codes `propertyTypes = ["residential_rental"]` and passes it to `buildListingsQuery`, which executes `listings.property_type IN ('residential_rental')`.
- No row matches → 0 results → map renders the "No homes match your filters" empty state. The map itself works; it just has nothing to plot.

`AddRentalListing` only writes real property types (`Single Family`, `Condo`, `Apartment`, etc.). The phantom `residential_rental` value is never written, so it can never match.

## Fix

Stop constraining buyer rental searches by the phantom `residential_rental` property type. The `listing_type = 'for_rent'` filter is the correct and sufficient gate for rentals.

### Changes

1. **`src/lib/buyerSearchRentFilters.ts`**
   - In `defaultRentToolbarCriteria()`, set `propertyTypes: []` instead of `["residential_rental"]`.
   - Keep `DEFAULT_RENTAL_PROPERTY_TYPES` export as `[]` (or remove if unreferenced) so nothing else re-introduces the bad filter.

2. **`src/pages/BuyerMapSearch.tsx`**
   - In `parseCriteriaFromUrl`, remove the block that overrides `urlCriteria.propertyTypes = ["residential_rental"]` when `listingType === "for_rent"`.
   - In the "For Rent" toggle button handler, set `propertyTypes: []` instead of `["residential_rental"]`.

3. **`src/pages/BrowsePropertiesNew.tsx`**
   - Same two edits: remove the rental URL override to `["residential_rental"]`, and the rental toolbar guard effect that re-sets `propertyTypes` to `["residential_rental"]` (lines ~180–185). Replace with a no-op or simply clear `propertyTypes` for rentals.
   - In the "For Rent" toggle handler, set `propertyTypes: []`.

### Out of scope (intentionally unchanged)

- No change to `buildListingsQuery`, the property-type map, or sale search.
- No change to the rental toolbar UI (it already hides the property-type filter on rentals).
- No change to map rendering, Maps API key handling, or status defaults — the map will populate as soon as listings come back.
- No DB migrations; existing rental rows are already correctly typed.

### Verification

- Reload `/buyer-search?lt=for_rent` (and the browse equivalent): the Coming Soon Boston rental at 300 Commercial Street should appear in the list and as a pin on the map.
- Sale search behavior is unchanged (the override only affected `listingType === "for_rent"`).
