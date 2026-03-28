

# Merge Filter Chips Into Action Bar and Make It Sticky

## What changes

### 1. `src/pages/ListingSearch.tsx` — Make action bar sticky + add filter chips

- Make the action bar card (`lines 177-227`) sticky: `sticky top-0 z-30 bg-white`
- Add active filter chips (towns, types, statuses) into the same row, between Reset and the results/View Results group
- The chips sit in the middle, flexing to fill available space

Layout of the sticky row:
```text
[ Reset ]  [ 1 town ] [ 2 types ] [ 8 statuses ]  ...gap...  [ 42 results ] [ View Results ] [ ↗ ]
```

### 2. `src/components/listing-search/ListingSearchFilters.tsx` — Remove sticky header

- Remove the entire sticky top action row (lines 268-295) that currently contains the chips and the duplicate Reset button
- The filter panel starts directly with the form content

## Not changing
- Filter logic, state, queries, URL params
- Chip styling (keep same Badge variant/sizing)
- Button styling or copy
- Filter form layout

