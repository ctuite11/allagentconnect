

# Fix: Two layout issues in SearchListingCard desktop view

## Issues from screenshot + feedback

1. **List Date and DOM are in the wrong place** — They're currently inline in the "Info row" (row B, line 330). Per the screenshot reference, they should be **stacked below price and $/sqft** in the right-aligned price block (same column as `$2,000,000` and `$853/sqft`).

2. **Status not visually centered** — The `Status: [Badge]` block sits inline in the flex row but isn't truly centered between address and price. It needs explicit centering.

3. **Photo banners still present** — Lines 267-273 still render the colored status overlay on the photo. These should be removed (status lives in the header now).

## Changes (SearchListingCard.tsx only)

### A. Move List Date + DOM into the price block (right-aligned, stacked)

**Remove** from info row (lines 342-349):
```
{listing.list_date && (...)}
{daysOnMarket > 0 && (...)}
```

**Add** to price block (after `$/sqft`, inside lines 321-326):
```tsx
<div className="flex-shrink-0 text-right">
  <div className="text-lg font-bold text-primary">{displayPrice}</div>
  {pricePerSqFt && (
    <div className="text-xs text-muted-foreground">${pricePerSqFt}/sqft</div>
  )}
  {listing.list_date && (
    <div className="text-xs text-muted-foreground">List Date: {format(new Date(listing.list_date), "MM/dd/yy")}</div>
  )}
  {daysOnMarket > 0 && (
    <div className="text-xs text-muted-foreground">DOM: {daysOnMarket}</div>
  )}
</div>
```

This matches the uploaded screenshot exactly: price → $/sqft → List Date → DOM, all right-aligned and stacked.

### B. Center the Status block

Change the header row from `flex items-start justify-between` to a structure that truly centers the status. Use `flex-1` on address and price blocks so the status sits in the middle:

```tsx
<div className="flex items-start gap-4">
  {/* Address — takes available space on left */}
  <div className="min-w-0 flex-1">...</div>

  {/* Status — centered */}
  <div className="flex-shrink-0 flex items-center gap-2 self-center">
    <span className="text-sm font-medium text-foreground">Status:</span>
    <ListingStatusBadge status={listing.status} size="lg" />
  </div>

  {/* Price — takes available space on right, text-right */}
  <div className="flex-shrink-0 text-right">...</div>
</div>
```

Adding `self-center` to the status block vertically centers it relative to the taller address/price columns.

### C. Remove photo banner overlay

Delete lines 267-273 (the `statusBanner` overlay on the desktop photo). Also delete lines 416-421 (mobile banner). Clean up `statusBanner` variable, `getStatusChangeBanner`, `BannerData` type, `BannerIcon` component, and unused imports (`Sparkles`, `TrendingDown`, `RefreshCw`).

## Summary

| What | From | To |
|------|------|----|
| List Date + DOM | Info row (inline) | Price block (stacked below $/sqft) |
| Status block | Left-of-price in flex | Centered between address and price, vertically centered |
| Photo banners | Present | Removed |

No other changes. No shell changes. No ListingCard changes.

