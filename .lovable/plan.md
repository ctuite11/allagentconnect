

# Refine Property Detail header — 3 adjustments

## File
`src/pages/PropertyDetail.tsx`

## Changes

### 1. Enlarge AAC logo and move it toward top of page
- Monogram: `w-7 h-7` → `w-8 h-8`
- Wordmark: `text-sm` → `text-base`
- Reduce top padding: `pt-5` → `pt-3` to push logo closer to the top edge

### 2. Reduce address font size
- Address `h1`: `text-xl` → `text-lg`

### 3. Reduce price font size
- Price: `text-xl font-bold` → `text-lg font-bold`
- Tighten gap between address and price: `gap-x-6` → `gap-x-4`

## Result
```text
[AAC logo (larger, near top)]

[← back]

[pin + address (text-lg) ............ price (text-lg)]
[..................................... price/sf]

[hero image]
```

All changes are page-local to `PropertyDetail.tsx` — no other files affected.

