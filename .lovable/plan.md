

# "Add All Towns" Button — Match Search Listings Format

## Change

### `src/components/GeographicPreferencesManager.tsx` (lines 292-294)

Change:
```tsx
{selectedCounty === "all" 
  ? `✓ Add All Towns from All Counties` 
  : `✓ Add All Towns in County (${townsList.length})`}
```

To:
```tsx
{`- Add All Towns (${townsList.length}) -`}
```

This matches the exact text format used on the search listings page. Single change, no logic affected.

