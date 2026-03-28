

# Fix: Price/SqFt Filter — Apply Consistently Without Flicker

## Root Cause

`pricePerSqFtMin` and `pricePerSqFt` (max) are stored in filter state and URL but **never applied anywhere**. Neither the count query nor the results query uses them. Any perceived flicker is from general async re-renders, not a double-pass — but the filter literally does nothing right now.

Since Price/SqFt is a derived value (`price / square_feet`) with no database column, it must be applied as a **client-side post-filter**. To prevent count/results mismatch and flicker, both pages must apply the same post-filter logic **before** setting state.

## Approach

Create a shared utility function and apply it identically in both pages, **before** the count/listings are committed to state.

## Files to modify

### 1. New utility: `src/lib/filterByPricePerSqft.ts`

```typescript
export function filterByPricePerSqft(
  listings: any[],
  minPpsf: string,
  maxPpsf: string
): any[] {
  const min = minPpsf ? parseFloat(minPpsf) : null;
  const max = maxPpsf ? parseFloat(maxPpsf) : null;
  if (!min && !max) return listings;
  
  return listings.filter(l => {
    const price = l.price;
    const sqft = l.square_feet;
    if (!price || !sqft || sqft <= 0) return false; // exclude invalid
    const ppsf = price / sqft;
    if (min && ppsf < min) return false;
    if (max && ppsf > max) return false;
    return true;
  });
}
```

### 2. `src/pages/ListingSearch.tsx` — count query

After `filterVisibleListings` (line 119), apply the Price/SqFt filter **before** setting count. The count query must also fetch `price` and `square_feet` columns (currently only selects `id, status, agent_id`).

- Change select to: `"id, status, agent_id, price, square_feet"`
- After line 119: `const filtered = filterByPricePerSqft(visible, filters.pricePerSqFtMin, filters.pricePerSqFt);`
- Set count from `filtered.length` instead of `visible.length`

### 3. `src/pages/ListingSearchResults.tsx` — results query

After `filterVisibleListings` (line 200), apply the same post-filter **before** setting listings state.

- After line 200: `listingsWithAgents = filterByPricePerSqft(listingsWithAgents, filters.pricePerSqFtMin, filters.pricePerSqFt);`
- This ensures the user never sees unfiltered results that then get removed.

## Why this prevents flicker

- The filter runs **synchronously before** `setResultCount` / `setListings`
- The component never renders intermediate unfiltered data
- Both pages use the identical function, so count always matches results

## Not changing
- Database schema (no new columns)
- UI inputs or layout
- URL serialization (already works)
- Any other filters

