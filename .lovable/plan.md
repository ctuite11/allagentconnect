

## 3 Fixes in SearchListingCard.tsx

### Fix 1 — ID and Price on same top line, Status centered between them
**Line 322**: Change `items-center` back to `items-start`. This keeps ID (top of left zone) and Price (top of right zone) on the same baseline. The Status block already has `self-center`, which will vertically center it relative to the tallest sibling — exactly what the screenshot needs.

### Fix 2 — Price size
**Line 374**: Already `text-base` — no further change needed (was reduced from `text-xl` → `text-lg` → `text-base`).

### Fix 3 — Phone icons AAC blue
**Lines 219 and 230**: Change `opacity-50` to `text-primary` on both `<Phone>` icons.

