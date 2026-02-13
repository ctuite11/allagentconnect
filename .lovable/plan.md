

# Replace Public Record Verification with Tax Information Section

## Summary
Replace the current "Public Record Verification" section (which just shows ATTOM lookup buttons and status) with a **Tax Information** section containing four manual-entry fields. The ATTOM auto-fill button and status indicators will be removed from this location.

## New Section Layout

**Title: "Tax Information"**

1. **Taxes** -- currency input (maps to existing `annual_property_tax` column)
2. **Assessed Value** -- currency input (maps to existing `assessed_value` column)
3. **Fiscal Year** -- numeric input, 4-digit year (maps to existing `fiscal_year` column)
4. **Residential Exemption** -- select dropdown with Yes / No / Unknown (maps to existing `residential_exemption` text column)

Layout: Row 1 has Taxes + Assessed Value side by side; Row 2 has Fiscal Year + Residential Exemption side by side.

## Technical Details

### File: `src/pages/AddListing.tsx`

**1. Add fields to `formData` initial state (~line 223)**
- `annual_property_tax: ""`
- `assessed_value: ""`
- `fiscal_year: ""`
- `residential_exemption: ""`

**2. Replace the "Public Record Verification" block (lines 3492-3545)**
Remove the ATTOM button, placeholder, status indicator, and condo-unit warning. Replace with four input fields in a clean layout using the existing form patterns (Label + Input/Select).

**3. Hydration in `loadExistingListing`**
Add the four new fields to the listing data hydration so they populate when editing an existing listing.

**4. Save in `buildListingDataFromForm`**
Map the four `formData` fields to their database column names when saving.

### Database
No migration needed -- the columns `annual_property_tax`, `assessed_value`, `fiscal_year`, and `residential_exemption` already exist in the `listings` table.

### Display Side
Update `ListingDetailSections.tsx` to show the tax fields in the existing (currently empty) "Tax Information" card by populating `taxInfoRows` with the new fields.
