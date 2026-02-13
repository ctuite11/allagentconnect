

# Fix AddressAutocomplete: Init-Once + Legacy Fallback for Full Address

## Summary

Refactor `src/components/AddressAutocomplete.tsx` to fix two bugs: the "works on second click" freeze caused by re-initialization on every keystroke, and the partial address storage (e.g. "16 N Mead" instead of "16 N Mead St, Charlestown, MA 02129").

Single file change. No new dependencies. No backend changes.

---

## Changes

### 1. Stable callback refs

Add refs for `onPlaceSelect`, `onChange`, `onError` and sync them with a dependency-guarded effect:

```typescript
const onPlaceSelectRef = useRef(onPlaceSelect);
const onChangeRef = useRef(onChange);
const onErrorRef = useRef(onError);

useEffect(() => {
  onPlaceSelectRef.current = onPlaceSelect;
  onChangeRef.current = onChange;
  onErrorRef.current = onError;
}, [onPlaceSelect, onChange, onError]);
```

All event handlers reference these refs instead of closure-captured values.

### 2. Init-once guard

Add `initializedRef = useRef(false)`. The main `useEffect` becomes `[]` deps and guards with:

```typescript
useEffect(() => {
  if (initializedRef.current) return;
  initializedRef.current = true;
  // ... load script + initAutocomplete using refs for callbacks
  return () => {
    // Remove listeners, null refs -- but do NOT reset initializedRef
    // (avoids double-init in StrictMode / route transitions)
  };
}, []);
```

This eliminates the current dependency on `[onPlaceSelect, onChange, placeholder, typesKey, value]` which causes teardown/reinit on every keystroke.

### 3. Lightweight prop updater (no teardown)

Separate effect to push `placeholder` and `types` changes to the existing autocomplete instance:

```typescript
useEffect(() => {
  if (!autocompleteRef.current) return;
  const parsed = JSON.parse(typesKey);
  if (autocompleteRef.current.setOptions) {
    autocompleteRef.current.setOptions({ types: parsed });
  }
  try { autocompleteRef.current.types = parsed; } catch {}
  // update placeholder similarly
}, [typesKey, placeholder]);
```

### 4. Deterministic legacy fallback in new-API path

After `fetchFields` returns empty `addressComponents`, instead of silently returning, call `PlacesService.getDetails`:

```typescript
if (!hasAddressComponents) {
  const placeId = place.id;
  if (placeId && google.maps.places.PlacesService) {
    const svc = new google.maps.places.PlacesService(document.createElement("div"));
    svc.getDetails(
      { placeId, fields: ["formatted_address","address_components","geometry","name","place_id"] },
      (details, status) => {
        if (currentRequestId !== requestIdRef.current) return;
        if (status === google.maps.places.PlacesServiceStatus.OK && details) {
          onPlaceSelectRef.current?.(details);
        }
      }
    );
    return;
  }
}
```

### 5. Add `place_id` to all field requests

Both the legacy Autocomplete creation and `getDetails` calls get `"place_id"` added to their `fields` arrays. This supports the fallback path.

### 6. Debug logging

Add guarded `debugLog` calls (behind existing `VITE_DEBUG_PLACES`) right before `onPlaceSelectRef.current?.(...)` in both paths, logging `formatted_address`, composed `address_line1`, `place_id`, and source (`"new-api"` / `"legacy"` / `"legacy-fallback"`).

---

## Expected Results

- Typing no longer freezes the preview (no re-init per keystroke)
- First click selects and populates the full address
- `address_line1` becomes "16 N Mead St" (with route suffix)
- City, state, zip all populated on first selection
- Verifiable instantly with `VITE_DEBUG_PLACES=true`

