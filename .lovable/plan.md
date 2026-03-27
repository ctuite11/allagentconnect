

# Fix: Simplify AddressAutocomplete to Legacy Autocomplete Only

## Scope
Only modify: `src/components/AddressAutocomplete.tsx`

## Why this is certain

The current 596-line component has **four independent permanent-failure paths**, each of which can leave the address field dead with no recovery:

1. `initializedRef` (line 289) — set `true` once, never reset. If init fails, the component never retries
2. Module-level `loaderPromise` (line 78) — a rejected promise is cached forever, blocking all future instances
3. `PlaceAutocompleteElement` shadow DOM sync (lines 463-478) — fragile, can silently fail to attach listeners
4. When `mode === "new-element"`, the plain `<Input>` is `display: none` (line 568) — if the Google element is broken, there is literally nothing visible to type in

None of these can be fixed by patching. The entire tiered system (`new-element` / `legacy` / `plain`) is the problem.

## What replaces it (~120 lines)

A single-path component using the proven legacy API:

1. **Key resolution** — same priority: URL `?gmaps_key=` > localStorage > env (this part is correct, keep it)
2. **Script loader** — inject script tag, resolve on load, reject on error. No module-level caching. No key-swap logic
3. **Component render** — always render a plain `<Input>`. It is always typeable from frame one
4. **useEffect** — load Google Maps script → `new google.maps.places.Autocomplete(inputRef.current, options)` → attach `place_changed` listener with `getDetails` fallback
5. **If Google fails** — input stays as normal text field. No dead state possible

### What gets removed
- `PlaceAutocompleteElement` path and all shadow DOM syncing
- `mode` state (`new-element` / `legacy` / `plain`)
- `containerRef` and hidden div
- `isGoogleElementBroken()` helper
- `brokenCheckTimerRef` and timeout
- `userTypingRef` and shadow input listeners
- Module-level `loaderPromise` / `loadedWithKey`
- `initializedRef` guard

### What stays identical
- Component props interface (no caller changes needed)
- `onPlaceSelect` callback shape (legacy Google place object with `formatted_address`, `address_components`, `geometry`)
- `place_changed` handler with `getDetails` fallback for incomplete results
- Key resolution order (URL > localStorage > env)
- Controlled `value` prop sync
- `onChange` on every keystroke

### Cleanup
- `google.maps.event.clearInstanceListeners` on unmount
- `isMounted` guard on async callbacks

## Technical detail

```text
Current (596 lines):
  Input ──► loader ──► PlaceAutocompleteElement (shadow DOM)
                           │ fails?
                           ▼
                       legacy Autocomplete
                           │ fails?
                           ▼
                       plain Input (but may be hidden)

Simplified (120 lines):
  Input (always visible, always typeable)
    │
    └─► useEffect: load script → attach Autocomplete
         │ fails? Input stays as-is. Done.
```

## Expected result
- Typing always works immediately
- Google suggestions appear when the API key is valid
- Selecting a suggestion populates address details via `onPlaceSelect`
- Bad key / broken load = input still works, just no suggestions
- Preview `?gmaps_key=` override still works
- No possible dead/stuck state

