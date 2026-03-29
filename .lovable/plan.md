

# Fix: DollarSign Icon Size in PriceRangePreferences

## Problem
The `DollarSign` icon in `PriceRangePreferences.tsx` is still `h-6 w-6` — the previous size reduction to `h-5 w-5` didn't persist.

## Change

### `src/components/PriceRangePreferences.tsx` (line 303)

Change:
```tsx
<DollarSign className="h-6 w-6 text-emerald-600/80" />
```

To:
```tsx
<DollarSign className="h-5 w-5 text-emerald-600/80" />
```

Single line change. This optically aligns the DollarSign glyph (which has more internal whitespace) with the Home and Bell icons in the other preference cards.

