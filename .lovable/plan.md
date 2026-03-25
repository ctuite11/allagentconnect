

# Fix: Restore Google Maps Address Autocomplete in Sale Listing

## Changes

### 1. `src/components/AddressAutocomplete.tsx` (lines 738-748)

Remove `disabled={!placesReady}` and fix the placeholder to always show the real text:

```tsx
<Input
  ref={inputRef}
  placeholder={placeholder || "City, State, Zip or Neighborhood"}
  className={className}
  value={value}
  name="address_line1"
  autoComplete="street-address"
  ...
```

- Line 741-743: Replace conditional placeholder with just `placeholder || "City, State, Zip or Neighborhood"`
- Line 747: Remove `disabled={!placesReady}`

### 2. `src/pages/AddListing.tsx` (lines 3190-3198)

Replace the plain `<Input>` with `<AddressAutocomplete>`:

```tsx
<AddressAutocomplete
  value={formData.address}
  onChange={(val) => setFormData(prev => ({ ...prev, address: val }))}
  onPlaceSelect={handleGooglePlaceSelect}
  placeholder="Enter street address"
  types={["address"]}
/>
```

### 3. `src/pages/AddListing.tsx` — Add handler (near other handlers)

Add a `handleGooglePlaceSelect` callback that uses `normalizeGooglePlace` to populate address fields:

```tsx
const handleGooglePlaceSelect = useCallback((place: any) => {
  if (!place?.address_components) return;
  const normalized = normalizeGooglePlace(place);
  setFormData(prev => ({
    ...prev,
    address: normalized.address_line1 || place.formatted_address?.split(',')[0] || '',
    city: normalized.city || prev.city,
    state: normalized.state || prev.state,
    zip_code: normalized.zip || prev.zip_code,
    latitude: normalized.lat ?? prev.latitude,
    longitude: normalized.lng ?? prev.longitude,
  }));
}, []);
```

## What stays the same
- Address reset logic (useEffect watching address/city/zip)
- Condo unit behavior
- Save/publish toolbar
- All other files

