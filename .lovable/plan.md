# Preview only before first publish, in the same tab

## Rule
Preview appears on Add/Edit Listing only for a listing that has **never been published** and is still a Draft. Once a listing has ever gone live, Preview is gone for good, even if it is later Pending, Sold, Cancelled, Temporarily Withdrawn, etc. The listing's own page is the agent's view of a published listing.

## Never-published Draft (including brand-new)
- Preview button shown.
- Click: save unsaved changes with the existing Draft save (listing stays Draft), then open the listing page **in the same tab**. Never publishes.
- If the save fails and there is no Draft yet, stay on the editor and show the existing error.
- Back returns to the editor; Back again returns to where the agent came from (e.g. My Listings). One tab throughout.
- A brand-new listing becomes a saved Draft on Preview (existing behavior), so Back lands in the same form showing everything entered.

## Already-published listings
Preview button hidden in every spot it appears (top bar and bottom actions). No save prompt, no Draft conversion, no separate preview mode.

## Unchanged
Publish, Save Draft, validation, status logic, photo gate, the listing page's Back handling, and Rental Preview.

## QA (no publishing, no real listing touched)
1. Brand-new listing -> Preview available, opens in same tab, Back keeps data.
2. Fake never-published test Draft -> Preview available; My Listings -> Edit -> Preview -> Back -> Back -> My Listings in one tab.
3. Unsaved change -> Preview saves it, listing stays Draft.
4. Open one of my own live listings and one previously published listing in a later status -> Preview button not shown (view only, nothing saved).
5. No status history, Hot Sheet, email, social, or DCMLS activity from Preview; test Draft deleted afterward while still Draft.
6. Tab count stays 1 on desktop and mobile sizes.
Not tested: the moment a Draft is actually published (would require a real publish).

## Technical details
- Both `/agent/listings/new` and `/agent/listings/edit/:id` use `src/pages/AddListing.tsx`; only this file changes.
- One `canPreview` flag, based on the raw saved status (`backendStatusRef.current`), never the form's selected/intended status:
  - Brand-new / no listing ID: eligible.
  - Existing listing with saved status other than `draft`: ineligible right away, no lookup.
  - Existing listing with saved status `draft`: existence check on `listing_status_history` (select id, `new_status <> 'draft'`, limit 1). No row: eligible. Any row: hidden permanently.
  - While loading or on error: hidden (fail closed).
- `canPreview` controls every Preview button (top/sticky and bottom actions) and also guards `handlePreview`.
- `handlePreview`: guard on the eligibility flag; remove `window.open("about:blank","_blank")`, `win.location.href`, `win.close()` and the `_blank` fallback; end with `navigate(previewUrl)`, keeping the existing `returnTo=/agent/listings/edit/:id?from=<safe from>`. Comment becomes "Save the draft, then open it on the listing page in the same tab."
- Because Preview is never offered on published listings, the current Draft-save path can no longer demote a live listing through Preview.
