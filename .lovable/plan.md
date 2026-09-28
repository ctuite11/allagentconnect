# Fix Save Draft button and Preview Back on Add/Edit Listing

## 1. Existing drafts get a Save Draft button
Right now, reopening a draft shows only **Preview | Publish**. The fix:
- **Listing is still a Draft:** show **Save Draft | Preview | Publish**, in both the top bar and the bottom row.
  - Save Draft keeps the listing as a Draft and saves the chosen status alongside it (current save-draft behavior).
  - Preview works as it does today.
  - Publish uses the existing publish flow, including the photo check and the "Ready to publish?" review.
- **Live listing being edited:** unchanged, still **Preview | Save Changes**.
- Concierge (staff) mode: unchanged.

## 2. Preview's Back returns to the editor
- Preview opens the listing page with a return link to that listing's edit page. This applies to new drafts after their first save, existing drafts, and live listings.
- On the listing page, Back goes to that edit page first. It only accepts links inside the site; anything else falls back to today's Back behavior.
- If a listing page is opened any other way (My Listings, search, Hot Sheets, shared links, DCMLS), Back behaves exactly as today.

## Not changing
Autosave, publish sequencing, the photo requirement, Hot Sheets, emails, social posting, DCMLS, statuses, or other pages.

## Technical details
- `src/pages/AddListing.tsx` `renderActionButtons()` (~3713): split the `listingId` branch. When `backendStatusRef.current === "draft"`, render three buttons: an outline Save Draft (`handleSaveDraft(false)`), Preview, and a Publish button calling the same handler/gates the current Publish label uses (`handleSaveChanges()`). Otherwise keep Preview plus Save Changes.
- `handlePreview` (~3307): open `/property/${id}?returnTo=${encodeURIComponent(`/agent/listings/edit/${id}`)}`.
- `src/pages/PropertyDetail.tsx` back handler (~265): before the history and `/listing-results` fallback, read `returnTo` from the search params and, if `isSafeInternalReturnPath` accepts it (starts with `/`, not `//`, same pattern as ConsumerPropertyDetail), navigate there.
- Heads-up: saving to GitHub main makes this live on allagentconnect.com right away. After that, the three draft-status live tests from earlier can run, including this new button.
