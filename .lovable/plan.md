
# Clean Up Address Section in Add Listing (For Sale Only)

## Scope

**Single file**: `src/pages/AddListing.tsx`

No changes to AddRentalListing, search filters, hot sheets, client needs, shared components, or `usZipCodesByCity`.

---

## What Changes

Replace the current address section layout (State/County first, city combobox, ZIP button-grid) with a clean, standard flow:

```text
Row 1: Street Address (+ Unit # for condo/apartment)
Row 2: City [Input]  |  State [Select]
Row 3: Zip [Input]   |  County [Select]
Row 4: Neighborhood [Select, conditional]
```

All fields auto-filled by AddressAutocomplete on place selection, all remain manually editable.

---

## Detailed Changes

### 1. Remove ZIP button-selector grid (lines 3462-3522)

Replace the entire block (loading spinner, button grid, "Selected" badge, manual fallback input) with a single `Input`:

```tsx
<div className="space-y-2">
  <Label htmlFor="zip_code">ZIP Code *</Label>
  <Input
    id="zip_code"
    type="text"
    placeholder="Enter ZIP code"
    value={formData.zip_code}
    onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
    required
  />
</div>
```

### 2. Replace city combobox (lines 3418-3459) with a simple Input

Remove the Popover/Command combobox. Replace with:

```tsx
<div className="space-y-2">
  <Label htmlFor="city">City/Town *</Label>
  <Input
    id="city"
    type="text"
    placeholder="Enter city"
    value={formData.city}
    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
    required
  />
</div>
```

### 3. Reorder field layout (lines 3360-3552)

Current order: State + County row, City combobox, ZIP selector, Neighborhood.

New order:
- **Row 2**: City (Input) + State (Select) -- side by side
- **Row 3**: Zip (Input) + County (Select) -- side by side
- **Row 4**: Neighborhood (Select, conditional -- unchanged logic)

Row 1 (Street Address + Unit) stays exactly as-is.

### 4. Remove dead state and effects

- **State variables to remove**: `suggestedZips`, `setSuggestedZips`, `suggestedZipsLoading`, `setSuggestedZipsLoading`, `availableZips`, `setAvailableZips`, `openCityCombo`, `setOpenCityCombo`, `citySearch`, `setCitySearch`, `showCityList`, `setShowCityList`, `expandedCities`, `setExpandedCities`
- **useEffect to remove**: The ZIP-fetching effect (lines 381-487) that calls `getZipCodesForCity`, edge function, and Zippopotam.us
- **Function to remove**: `handleZipSelect` (line 514-516), `toggleCityExpansion` (lines 489-499)
- **Imports to remove**: `getZipCodesForCity`, `hasZipCodeData` from `usZipCodesByCity`

### 5. Simplify onPlaceSelect handler (lines 3259-3340)

Remove lines that set now-dead state (`setSuggestedZips`, `setAvailableZips`, `setAvailableCities`, `setCityChoice`, `setSelectedCity`). The handler still sets `formData` fields (address, city, state, zip_code, county, lat, lng) and `setSelectedState`/`setSelectedCounty` for the county dropdown.

### 6. Keep intact

- `selectedState` / `setSelectedState` -- still needed for county dropdown population
- `selectedCounty` / `setSelectedCounty` -- still needed for county select and neighborhood lookup
- `availableCounties` / the county useEffect (lines 286-308) -- still needed, but simplify to not clear city/zip (those are now simple inputs)
- `cityChoice` / `selectedCity` -- can be removed since city is now just `formData.city`
- Neighborhood section -- unchanged logic, just moves to Row 4
- `isHydratingLocationRef` -- still needed for the county useEffect guard
- The `availableCities` useEffect (lines 311-333) and `locationValidation` useEffect (lines 337-344) can remain but will reference `formData.city` directly

---

## What does NOT change

- `AddressAutocomplete` component
- `normalizeGooglePlace` utility
- `usZipCodesByCity.ts` data file
- `AddRentalListing.tsx`
- Any search filter, hot sheet, client needs, or other page
- Form validation schema (zip_code regex stays the same)
- Database save logic (formData shape unchanged)
- ATTOM verification logic
