
# Fix: Back Button Returns to "My Listings" Instead of Search Page

## Problem
When viewing a listing from "My Listings", clicking the back button incorrectly takes you to the Search page instead of back to "My Listings".

## Root Cause
The navigation from "My Listings" to the property detail page doesn't include a `from` state parameter. The Property Detail page then defaults to `/listing-search` when no origin is specified.

## Solution
Update the `handlePreview` function in My Listings to pass the current route as the `from` state.

## Changes

### File: `src/pages/MyListings.tsx`

**Current code (line 860):**
```javascript
const handlePreview = (id: string) => {
  navigate(`/property/${id}`);
};
```

**Updated code:**
```javascript
const handlePreview = (id: string) => {
  navigate(`/property/${id}`, { state: { from: '/agent/listings' } });
};
```

## How It Works
1. When you click "View" on any listing in My Listings, the navigation now includes `{ from: '/agent/listings' }`
2. The Property Detail page reads this via `location.state?.from`
3. When you click the back button, it navigates to `/agent/listings` (My Listings) instead of defaulting to `/listing-search`

## Technical Notes
- This follows the existing pattern already used in `ListingResultCard.tsx` which passes `fromPath` state
- No changes needed to `PropertyDetail.tsx` as it already supports the `from` state parameter
- The same pattern should ideally be applied anywhere listings are viewed (grid view clicks, etc.)
