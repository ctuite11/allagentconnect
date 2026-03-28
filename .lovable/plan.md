

# Fix Draft-Bounce Bug in Auto-Save

## Problem

When editing a non-draft listing (e.g. `back_on_market`), the 3-second debounced auto-save calls `handleSaveDraft(true)`, which forces `status: "draft"` via `buildListingDataFromForm(uploaded, "draft", freshUser.id)`. This silently resets the listing status to draft on every keystroke during editing.

This is why the status history shows: `back_on_market → draft → back_on_market` on every save, and why the 48-hour auto-revert edge function may malfunction (it reads the latest history entry).

## Root cause

**Line 367-368**: Auto-save unconditionally calls `handleSaveDraft(true)` regardless of whether the listing is a draft or an existing published/active/back_on_market listing.

**Line 2206**: `handleSaveDraft` always passes `"draft"` as the status override: `buildListingDataFromForm(uploaded, "draft", freshUser.id)`.

## Fix

### File: `src/pages/AddListing.tsx`

**1. Auto-save effect (lines 362-373)**: Add a guard so that when in edit mode (`listingId` is set) and the listing is not a draft, auto-save calls `handleSaveChanges` (which preserves current status) instead of `handleSaveDraft`.

```tsx
useEffect(() => {
  if (!user || !hasUnsavedChanges) return;

  const debounceTimeout = setTimeout(() => {
    // In edit mode for non-draft listings, use handleSaveChanges to preserve status
    if (listingId && backendStatusRef.current && backendStatusRef.current !== "draft") {
      handleSaveChanges(true); // pass silent flag
    } else {
      handleSaveDraft(true);
    }
  }, 3000);

  return () => clearTimeout(debounceTimeout);
}, [user, hasUnsavedChanges, formData, photos, floorPlans, documents, disclosures, propertyFeatures, amenities]);
```

**2. handleSaveChanges (~line 2327)**: Add an optional `isAutoSave` parameter (similar to `handleSaveDraft`) so it can run silently without showing toasts or navigating away.

```tsx
const handleSaveChanges = async (isAutoSave = false) => {
  // ... existing logic ...
  // When isAutoSave: suppress toast, suppress navigation, use setAutoSaving instead of setSubmitting
};
```

Key changes inside `handleSaveChanges` when `isAutoSave` is true:
- Use `setAutoSaving(true)` instead of `setSubmitting(true)`
- Skip the navigation at the end (lines 2458-2463)
- Skip the success toast (line 2457)
- Still save the payload with current form status (no "draft" override)

**3. handleNavigateToManagePhotos / handleNavigateToManageFloorPlans (~lines 2496, 2542)**: These already pass `undefined` as the status override, so they correctly preserve the current form status. No change needed.

## What this fixes

- Auto-save on a `back_on_market` listing no longer resets status to `draft`
- Status history stays clean — no phantom `draft` entries
- The 48-hour auto-revert edge function works correctly because the history is accurate
- Draft auto-save behavior is unchanged (still forces `"draft"` for new/draft listings)

## One file changed
`src/pages/AddListing.tsx`

## No changes to
- Edge functions, status constants, sidebar, routing, save button behavior, manual save flows
