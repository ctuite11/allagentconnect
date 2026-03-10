

# Fix: Status alignment, spacing, icons

## Changes (SearchListingCard.tsx only)

### 1. Move Status to top (remove `self-center`)
Line 300: Remove `self-center` so it aligns at `items-start` (top) with address and price.

### 2. Reduce stats row spacing
Line 339: Change `mt-2` to `mt-1` on the stats row (beds/baths/sqft).

### 3. Add vertical gap between $/sqft and List Date
Insert `mt-1` wrapper around the List Date + DOM lines (lines 311-316) to separate them from the $/sqft line above.

### 4. City MapPin icon → AAC blue
Line 291: Change `MapPin` class from default to `text-primary` (AAC blue, outline only — lucide icons are already stroke-based).

### 5. Neighborhood — add red MapPin icon
Line 295: Add `<MapPin className="w-3 h-3 mr-1 text-red-500" />` before the neighborhood text, wrapped in a flex row to align with city line.

