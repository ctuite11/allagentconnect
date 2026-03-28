

# Fix: Standardize Required-Field Error Styling and Scroll Behavior

## Problem

1. **Inconsistent error styling**: The price field uses `ring-2 ring-destructive/50 bg-destructive/5` (strong) while all other required fields use `ring-1 ring-destructive/20` (faint). They should all match the stronger style shown on price.

2. **Scroll may not reach top**: The validation summary scroll uses `validationSummaryRef.current?.scrollIntoView()` which scrolls to the summary element — but if the summary isn't at the very top of the page, the user may not see it. Should also call `window.scrollTo(0, 0)` to guarantee top-of-page scroll.

## Changes — One file: `src/pages/AddListing.tsx`

### 1. Standardize all `hasFieldError` styling to match the strong treatment

Replace every instance of `ring-1 ring-destructive/20` with `ring-2 ring-destructive/50 bg-destructive/5` across all field wrappers:

- `go_live_date` (line ~3090)
- `address` (line ~3209) — also remove the extra `border-destructive` class
- `city` (line ~3304)
- `state` (line ~3318)
- `zip_code` (line ~3353)
- `county` (line ~3367)
- `monthly_rent` (line ~3502)
- `listing_agreement_type` (line ~4412)

The `price` field (line ~3442) already has the correct styling.

### 2. Add `window.scrollTo(0, 0)` on validation failure

At both validation-failure points (lines ~2358 and ~2603), add `window.scrollTo({ top: 0, behavior: 'smooth' })` before or alongside the `scrollIntoView` call to ensure the page always scrolls to the very top when required fields are missing.

## Expected result

- All required fields show the same visible red ring + tint when invalid
- Page always scrolls to the top when publish/save finds missing required fields
- No layout, filter, or unrelated changes

