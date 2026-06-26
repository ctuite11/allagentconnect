# Hot Sheet Match Email — Photo Cut-Off Fix

## Root cause

In `supabase/functions/_shared/listingEmailCard.ts`, the hero photo in `renderCompactListingEmailCard` (used by `renderHotSheetMatchListingEmailCard`) is rendered as:

```html
<img width="600" height="170"
     style="width:100%;max-width:600px;height:170px;object-fit:cover;..." />
```

The width is fluid (`width:100%`), but the height is locked to **170px**. On mobile email clients (Yahoo, Gmail mobile, iOS Mail), the container shrinks well below 600px while the height stays pinned at 170px. With `object-fit:cover`, the renderer crops more and more of the photo horizontally to fill the now-much-taller-relative box. The result: the listing photo appears severely cut off / zoomed in on mobile.

The full-size card (`renderSearchStyleListingEmailCard`, line 248) has the same fixed-height pattern at a larger height — same issue, just less obvious because it's only used in single-listing emails.

## Fix

Make the hero photo scale proportionally instead of force-cropping:

1. **Compact card (Hot Sheet match)** — `renderCompactListingEmailCard`
   - Drop the fixed `height="170"` HTML attribute and `height:170px` inline style.
   - Replace `object-fit:cover` with `height:auto` so the image scales to its native aspect ratio (typical 4:3 listing photos render ~450px tall at 600px wide on desktop, ~285px at 380px wide on mobile — no cropping).
   - Keep `width="600"` and `max-width:600px` for desktop sizing.
   - Update the "Photo unavailable" placeholder to use the same height behavior so empty states stay consistent (keep its 170px since it has no aspect to preserve, but mark it explicitly as a fallback).

2. **Search-style card (single-listing emails)** — `renderSearchStyleListingEmailCard`
   - Apply the same `height:auto` change so price-change / share / inquiry emails don't crop either.

3. Redeploy affected edge functions so the change goes live:
   - `process-hot-sheet`
   - `send-new-match-notification`
   - `send-listing-share`
   - `send-bulk-listing-share`
   - `send-hot-sheet-invite` (uses the same shared card)

## Technical details

Files touched:
- `supabase/functions/_shared/listingEmailCard.ts` — two `<img>` blocks (lines ~248 and ~359).

No frontend changes. No DB changes. No copy changes.

## Verification

- Send a test Hot Sheet match to a Yahoo/Gmail address.
- Confirm the hero photo renders full and uncropped on mobile and desktop.
- Confirm existing listing-share/inquiry emails still look correct (proportional, no layout break).
