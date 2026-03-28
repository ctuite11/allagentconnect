

# Fix Standard Criteria Layout — Each Range Field Gets Its Own Full-Width Row

## Problem

Living Area, Price/SqFt, and Year Built have Min/Max pairs crammed into half-width grid cells alongside other fields. The dual inputs inside a half-width cell look squished and inconsistent with the single-input fields above them.

## Solution

Give each range field (Living Area, Price/SqFt, Year Built) its own full-width row. The Min/Max inputs share that full row, so they have plenty of breathing room.

## File: `src/components/listing-search/ListingSearchFilters.tsx`

### Current structure (lines 455-569):
```
grid-cols-2: Bedrooms | Total Baths
grid-cols-2: Rooms    | Acres
grid-cols-2: Living Area [Min][Max] | Price/SqFt [Min][Max]
grid-cols-2: Year Built [From][To]  | Parking
```

### New structure:
```
grid-cols-2: Bedrooms | Total Baths
grid-cols-2: Rooms    | Acres
full-width:  Living Area  [  Min  ][  Max  ]
full-width:  Price/SqFt   [  Min  ][  Max  ]
full-width:  Year Built   [ From  ][  To   ]
grid-cols-2: Parking  | (empty or future field)
```

### Changes

1. **Lines 499-538** — Break the `grid-cols-2` wrapper around Living Area + Price/SqFt into two separate full-width `<div>` blocks, each containing one label + `flex gap-2` with two `flex-1` inputs.

2. **Lines 539-569** — Break the `grid-cols-2` wrapper around Year Built + Parking. Year Built becomes its own full-width row. Parking moves into a new `grid-cols-2` row (with one cell, or paired with Garage if it exists).

3. Each full-width range row uses `flex gap-2` with `flex-1` on both inputs — same as now, but with double the horizontal space.

## Not changing
- Input styling, heights, or border radius
- Grid layout for single-input fields (Bedrooms, Baths, Rooms, Acres)
- Any other filter sections
- Filter state, URL params, or query logic

## Expected result
- Range fields have generous space for Min/Max side by side
- Single-input fields stay paired in `grid-cols-2`
- Clean, consistent vertical rhythm throughout Standard Criteria

