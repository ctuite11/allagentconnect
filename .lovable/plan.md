

# Fix "Add All Towns" Button — Green Text on Comms Page

## Problem
The green text + gray background style was only applied to `ListingSearchFilters.tsx`. The Communications page uses `GeographicPreferencesManager.tsx`, which still has the old neutral styling.

## Change

### `src/components/GeographicPreferencesManager.tsx` (line 290)

Change:
```tsx
className="w-full text-left px-2 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded mb-1 border-b border-zinc-200 pb-2"
```

To:
```tsx
className="w-full text-left px-2 py-1.5 text-sm font-medium text-emerald-600 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors mb-1"
```

Removes the old `border-b border-zinc-200 pb-2` and applies the same gray background + green text treatment already on `ListingSearchFilters.tsx`.

