

# Allow Publishing with Price Range

## Summary
Update the Zod validation in `src/pages/AddListing.tsx` so agents can publish with either an exact price OR a price range (min/max). Currently, the exact `price` field is required, causing validation failure when only a price range is entered.

## Changes (single file: `src/pages/AddListing.tsx`)

### 1. Update Zod schema (lines 70-93)

Make `price` optional and add `price_range_min` / `price_range_max` fields. Add two refinements:
- At least one pricing method must be provided
- If both range ends exist, min must be less than or equal to max

### 2. Update `dataToValidate` (lines 2585-2601)

Replace the current `price` line with safe parsing that avoids `NaN`:
- Only pass `price` when the raw string parses to a finite number
- Add `price_range_min` and `price_range_max` with the same safe parsing

## Technical Details

**Schema (line 74, then after line 93):**
```typescript
// Line 74: change to optional
price: z.number().min(100).max(100000000).optional(),

// After lot_size, add:
price_range_min: z.number().min(100).max(100000000).optional(),
price_range_max: z.number().min(100).max(100000000).optional(),

// Change closing to add refinements:
}).refine(
  (d) => d.price != null || d.price_range_min != null || d.price_range_max != null,
  { message: "Please enter a Listing Price or a Price Range.", path: ["price"] }
).refine(
  (d) => d.price_range_min == null || d.price_range_max == null || d.price_range_min <= d.price_range_max,
  { message: "Price Range Min must be <= Price Range Max.", path: ["price_range_min"] }
);
```

**dataToValidate (line 2590):**
```typescript
const rawPrice = formData.listing_type === "for_sale"
  ? parseFloat(formData.price) : parseFloat(formData.monthly_rent);
const minNum = parseFloat(formData.price_range_min);
const maxNum = parseFloat(formData.price_range_max);

// In the object:
price: Number.isFinite(rawPrice) ? rawPrice : undefined,
price_range_min: Number.isFinite(minNum) ? minNum : undefined,
price_range_max: Number.isFinite(maxNum) ? maxNum : undefined,
```

No database or other file changes needed.
