
# Fix: Share Button Not Working (URL Routing Issue)

## Problem
When users click the "Share" button on a listing, the shared URL uses `/social-preview/{id}` path. However:
- The Netlify Edge Function only intercepts `/property/*` paths
- There's no React route for `/social-preview/*`
- Result: Clicking shared links leads to a 404 page

## Root Cause
The `getListingShareUrl()` function in `src/lib/getPublicUrl.ts` returns a `/social-preview/` path that doesn't exist in either the edge function routing or the React router.

## Solution
Change `getListingShareUrl()` to use `/property/{id}` instead of `/social-preview/{id}`.

The current edge function architecture already handles this correctly:
- **Crawlers** (Facebook, Twitter, etc.) → Edge function intercepts and serves OG metadata
- **Regular users** → Edge function passes through to the SPA

The `/social-preview/` path was a design artifact that's no longer needed.

---

## Technical Changes

### File: `src/lib/getPublicUrl.ts`

**Current code (line 22-24):**
```typescript
export const getListingShareUrl = (listingId: string): string => {
  return `${getPublicOrigin()}/social-preview/${listingId}`;
};
```

**Updated code:**
```typescript
export const getListingShareUrl = (listingId: string): string => {
  return `${getPublicOrigin()}/property/${listingId}`;
};
```

Also update the JSDoc comment to reflect the new behavior (lines 16-21).

---

## How It Works After the Fix

```text
User clicks Share → URL: /property/abc123

        ┌──────────────────┐
        │  Netlify Edge    │
        │  social-preview  │
        └────────┬─────────┘
                 │
     ┌───────────┴───────────┐
     │                       │
  Crawler?                Regular User?
     │                       │
     ▼                       ▼
┌─────────────┐      ┌─────────────┐
│  Supabase   │      │   React     │
│  OG Tags    │      │   SPA       │
└─────────────┘      └─────────────┘
```

---

## Verification Steps

1. Deploy the change
2. Navigate to any listing detail page
3. Click the Share button
4. Select "Copy Link" - verify the copied URL uses `/property/` not `/social-preview/`
5. Paste the link in a new incognito tab - verify it loads the property page correctly
6. Test in Facebook Sharing Debugger - verify OG metadata still appears correctly

---

## Impact

- **Users**: Shared links now work correctly for all visitors
- **Social platforms**: No change - crawlers still receive proper OG metadata via the edge function
- **Backward compatibility**: Any existing `/social-preview/` links shared before this fix will still 404 (they were already broken)
