

# Fix: Save Draft navigates to all listings instead of draft filter

## File
`src/pages/AddListing.tsx`

## Change
**Line 2271** — change the navigation target after manual draft save:

```tsx
// Before
navigate(`${ROUTES.MY_LISTINGS}?status=draft`);

// After
navigate(ROUTES.MY_LISTINGS);
```

This removes the `?status=draft` query parameter so the user lands on My Listings showing all statuses instead of only drafts.

## What stays the same
- Auto-save behavior (no navigation)
- Publish flow navigation
- Everything else

