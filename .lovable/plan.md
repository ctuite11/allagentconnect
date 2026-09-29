# Preview opens in the same tab (Add/Edit Listing)

## What changes
Clicking **Preview** in Add Listing or Edit Listing will save any unsaved changes as a Draft (same as today), then go to the listing page **in the same tab**. No new tab or window is ever opened. Back on the preview returns to the editor, and Back from the editor returns to where the agent came from (e.g. My Listings).

## Unchanged
Publish, Save Draft, validation, listing status logic, photo gate, and the listing page's existing Back handling. Preview never publishes. The Rental form's Preview (currently a "coming soon" message) is not touched.

## Brand-new listing note
A new listing must be saved as a Draft before it can be previewed (existing behavior). So after Preview → Back, the agent lands in the same editor showing that saved Draft, with everything they entered. The editor page address changes from "add" to "edit" behind the scenes; the screen is the same form.

## QA (no publishing)
Using one clearly fake test Draft, deleted afterward while still Draft:
1. My Listings → Edit → Preview → Back → Edit → Back → My Listings, one tab.
2. New listing → enter data → Preview → Back → entered data still there.
3. Edit a field without saving → Preview → change was saved and listing is still Draft.
4. Status stays Draft throughout; no status history, Hot Sheet, email, social, or DCMLS activity.
5. Tab count stays at 1 on desktop and mobile sizes.

## Technical details
- `src/pages/AddListing.tsx` `handlePreview`: remove `window.open("about:blank","_blank")`, `win.location.href`, `win.close()`, and the `window.open(previewUrl,"_blank")` fallback; end with `navigate(previewUrl)`. Keep the existing `returnTo` built from `/agent/listings/edit/:id?from=<safe from>`.
- Navigation happens only after the awaited draft save, so the unsaved-changes guard is not triggered by pending edits (confirm during QA; if a leave-page prompt fires, clear the dirty flag only after a successful save).
- `PropertyDetail.tsx` already honors a safe `returnTo`; no change.
