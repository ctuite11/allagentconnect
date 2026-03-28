


# Fix Draft-Bounce Bug in Auto-Save — COMPLETED

## What was fixed

In `src/pages/AddListing.tsx`:

1. **Auto-save effect**: Now checks if editing a non-draft listing — if so, calls `handleSaveChanges(true)` instead of `handleSaveDraft(true)`, preserving the current status.

2. **handleSaveChanges**: Added `isAutoSave` parameter. When true:
   - Uses `setAutoSaving` instead of `setSubmitting`
   - Skips validation, duplicate check, toast, and navigation
   - Still saves the payload with the current form status (no "draft" override)

## Result
- Auto-save on `back_on_market` listings no longer bounces through `draft`
- Status history stays clean
- Draft auto-save unchanged
