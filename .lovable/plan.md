

# Change "Asking Price" to "Estimated Home Value" on Seller Match Form

## What Changes

Two files need a label update (the underlying database column `asking_price` stays the same -- this is a display-only change):

### 1. `src/pages/AgentMatch.tsx` (the input form)
- **Line 603**: Change the label from `Asking Price *` to `Estimated Home Value *`
- **Line 609**: Update placeholder from `$650,000` to `$650,000` (keep as-is, still appropriate)

### 2. `src/pages/SellerListingDetail.tsx` (the detail view)
- **Line 289**: Change the display label from `Asking Price` to `Estimated Home Value`

## What Does NOT Change
- The database column name (`asking_price`) remains unchanged
- Validation logic remains the same
- No other files are affected

## Technical Detail
Both edits are single-line string replacements. The field name in state (`asking_price`) and the database column are untouched -- only the user-facing label text changes.

