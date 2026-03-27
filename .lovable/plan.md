

# Fix AddressAutocomplete — Always Typeable

**File:** `src/components/AddressAutocomplete.tsx` (only file modified)

## Problem

The input is locked (`disabled={!placesReady}`) when Places API fails to load. With an invalid or missing key, the field stays permanently disabled. The placeholder also misleads with "Loading address search..." that never resolves.

## Changes

### 1. Remove disabled gate (line 747)
Remove `disabled={!placesReady}` from the `<Input>`. The field must always accept typing.

### 2. Fix placeholder (lines 740-744)
Replace conditional placeholder with a constant:
```tsx
placeholder={placeholder || "Start typing an address..."}
```

### 3. Add userTypingRef for Shadow DOM sync
Add a `userTypingRef = useRef(false)` that tracks manual input. Wire a native `input` event listener on the DOM element so manual entries aren't overridden by autocomplete state sync. Reset the ref on blur and on place selection.

### 4. Key-mismatch recovery in loadGoogleMapsPlaces
When an existing script is found but Places isn't ready and `dataset.loaded` is already `"true"`, check for `InvalidKeyMapError`-style failures (inspect DOM for `gmp-error` elements). If detected, remove the old script element, then re-inject with the current key. This handles cases where the key changed between page loads.

### 5. Keep loadError notice as-is
The existing `{loadError && <p>...</p>}` block stays — it shows a helpful message when autocomplete suggestions won't appear, but the input remains usable for manual typing.

## What stays unchanged
- PlaceAutocompleteElement (new element) path
- Legacy Autocomplete path logic
- `getGmapsKey()` key resolution order
- `onPlaceSelect` callback handling
- All other files

