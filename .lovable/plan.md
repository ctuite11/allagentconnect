

## Switch listing card checkbox to AAC green (accent)

Two lines change per checkbox (desktop + mobile) in `SearchListingCard.tsx`.

### Changes

**File: `src/components/listing-search/SearchListingCard.tsx`**

**Desktop checkbox (line 284):** Change `bg-primary border-primary` → `bg-accent border-accent`

**Mobile checkbox (line 480):** Same change — `bg-primary border-primary` → `bg-accent border-accent`

This uses the same emerald-600 green (`--accent: 160 84% 39%`) that the search page filter checkboxes use, matching the system-wide checkbox color.

No other files or styling changes needed.

