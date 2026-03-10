

## 2 Small Fixes in SearchListingCard.tsx

### Fix 1 — Center the Status between ID and Price
**Line 367**: The center zone has `min-w-[100px]` and `pt-1` but no vertical centering relative to the flanking columns. Change it to use `self-center` so it vertically centers between the left and right zones regardless of their height.

```tsx
// Line 367: change pt-1 → self-center
<div className="flex-shrink-0 flex items-center justify-center gap-1.5 min-w-[100px] self-center">
```

### Fix 2 — Reduce font sizes
- **Address** (line 338): `text-base` → `text-sm`
- **Price** (line 374): `text-xl` → `text-lg`

No other changes. Layout, facts grid, remarks, footer, mobile — all untouched.

