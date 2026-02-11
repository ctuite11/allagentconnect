

# Update: Off Market/Private Listings Include Expiration Date

## Summary

Two changes needed:

1. **AddListing.tsx** (line 3137): Remove the `off_market` exclusion so the date section (AAC List Date + Expiration Date) is visible for off_market/private listings too.
2. **MyListings.tsx** (lines 640-645): Restructure the date display for all three cases:
   - **Coming Soon**: AAC List Date, On MLS Date (`go_live_date`), Expiration Date
   - **Off Market / All other statuses**: AAC List Date, Expiration Date

## File: `src/pages/AddListing.tsx`

### Line 3137: Remove off_market gate

Current:
```tsx
{formData.status !== 'off_market' && (
```

New -- show for all statuses. The condition becomes unconditional (just remove the wrapper, keep the inner grid). The label "List Date (On MLS)" should also be renamed to "AAC List Date" for consistency.

For Coming Soon, restructure to three equal columns:
- Col 1: AAC List Date (`list_date`)
- Col 2: On MLS Date (`go_live_date`) -- move from the separate bordered box above
- Col 3: Expiration Date (`expiration_date`)

For all other statuses (including off_market): two columns as today, but always shown:
- Col 1: AAC List Date (`list_date`)
- Col 2: Expiration Date (`expiration_date`)

The separate `go_live_date` bordered box (lines 3102-3118) merges into the Coming Soon three-column layout.

## File: `src/pages/MyListings.tsx`

### Lines 640-645: Three-tier date display

Current logic shows "On MLS Date" or "Exp" conditionally on the same `expiration_date` field.

New logic:
- **Coming Soon**: Show three lines using `go_live_date` for On MLS Date and `expiration_date` for Exp
- **All others** (including off_market): Show AAC List Date + Exp (if exists)

Add `go_live_date` formatting around line 553.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/AddListing.tsx` | Remove off_market exclusion from date section; merge go_live_date into 3-col layout for Coming Soon; rename label to "AAC List Date" |
| `src/pages/MyListings.tsx` | Add `go_live_date` display for Coming Soon; show 3 date lines for Coming Soon, 2 for all others including off_market |

