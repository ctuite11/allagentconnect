

# Fix: Photos not loading on Buyer Detail page

## Root Cause
The `photos` column in the `listings` table stores a JSON array where each element can be either:
- A plain string URL: `"https://..."`
- An object with a `url` property: `{ url: "https://..." }`

The current code in `HotSheetBuyerDetail.tsx` does `lPhotos[0]` assuming it's always a string. When it's an object like `{ url: "https://..." }`, the `<img src>` receives `[object Object]` and fails to load.

This pattern is confirmed by multiple other components that handle both cases (e.g., `DraftListings.tsx`, `ClientHotSheet.tsx`, `RecentlySold.tsx`).

## Fix

### `src/pages/HotSheetBuyerDetail.tsx`
Add a small helper to extract the URL from either format, then use it when collecting photos from matched listings:

```typescript
function getPhotoUrl(photo: any): string | null {
  if (!photo) return null;
  if (typeof photo === "string") return photo;
  return photo?.url || null;
}
```

Update line ~141 where photos are collected:
```typescript
// Before:
if (lPhotos?.length && photos.length < 4) photos.push(lPhotos[0]);

// After:
if (lPhotos?.length && photos.length < 4) {
  const url = getPhotoUrl(lPhotos[0]);
  if (url) photos.push(url);
}
```

### Also fix `src/pages/HotSheets.tsx`
The parent Buyer HotSheets page likely has the same issue when fetching mosaic photos. Apply the same `getPhotoUrl` helper there.

No other files need changes.

