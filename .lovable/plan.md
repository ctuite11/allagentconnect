

# Fix Address Autocomplete Dropdown Not Appearing

**File:** `src/components/AddressAutocomplete.tsx` (only file modified)

## Root Cause

The component has a rendering chicken-and-egg problem:

1. On mount, `useNewElement` is `false`, so only `<Input ref={inputRef}>` renders — `containerRef.current` is `null`
2. `initAutocomplete` checks `places?.PlaceAutocompleteElement && containerRef.current` (line 273) — this is always `false` because the container div isn't mounted
3. It correctly falls through to the legacy `Autocomplete` path (line 492-512), which **should** work

The actual issue is that **both** refs need to be in the DOM simultaneously so the component can choose the right path at runtime. Currently the conditional rendering (`useNewElement ? container : input`) means one is always missing.

Additionally, the `initializedRef` (line 217) prevents re-initialization if the component unmounts and remounts (e.g., navigating between pages), since cleanup (line 681) intentionally doesn't reset it — but this means returning to the page shows a dead input.

## Changes

### 1. Render both elements, hide one with CSS

Replace the conditional render (lines 756-778) so both the container div and the Input are always in the DOM, but visibility is toggled:

```tsx
return (
  <div className="w-full">
    <div
      ref={containerRef}
      className={className}
      style={{ display: useNewElement ? "block" : "none" }}
    />
    <Input
      ref={inputRef}
      placeholder={placeholder || "Start typing an address..."}
      className={className}
      value={value}
      name="address_line1"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      inputMode="text"
      data-lpignore="true"
      data-1p-ignore="true"
      data-form-type="other"
      onChange={(e) => onChangeRef.current?.(e.target.value)}
      onBlur={handleBlur}
      style={{ display: useNewElement ? "none" : "block" }}
    />
    {loadError && (
      <p className="text-xs text-destructive mt-1">{loadError}</p>
    )}
  </div>
);
```

This ensures `containerRef.current` is available when `initAutocomplete` runs, allowing the new PlaceAutocompleteElement path to work. If that path fails, it falls back to legacy on the always-present Input.

### 2. Fix autoComplete attribute conflict

Change `autoComplete="street-address"` to `autoComplete="off"` on the Input (shown above). Browser native autocomplete can interfere with Google's dropdown.

### 3. Reset initializedRef on full unmount

In the cleanup function (line 681), reset `initializedRef.current = false` so the component properly re-initializes when navigating back to the page:

```tsx
return () => {
  isMounted = false;
  placesReadyRef.current = false;
  initializedRef.current = false;  // Allow re-init on remount
  // ... rest of cleanup
};
```

### What stays unchanged
- Key resolution logic (`getGmapsKey`)
- Script loading and recovery logic
- Place selection handlers (both new and legacy)
- All event listener wiring
- `userTypingRef` and Shadow DOM sync

