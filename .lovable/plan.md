# Fix Manage Photos / Floor Plans return flow from Add Listing

## Goal
Add Listing → Manage Photos (or Floor Plans) → Save & Return brings the agent back to the same form. The heading still says "Add listing", and the page lands on the Property Photos (or Floor Plans) section instead of the top.

## Changes (frontend only)
1. **Add Listing: carry the origin.** When the agent opens Manage Photos or Manage Floor Plans, send along where they came from: the Add Listing workflow, which section to return to (`section-photos` or the floor-plans area), and the form's existing `from` back-target.
2. **Manage Photos/Floor Plans page: return to that origin.** Save & Return (and the existing back control) use the carried origin. With no origin, for example on an existing listing or a direct link, it keeps today's behavior and goes to `/agent/listings/edit/{id}`.
3. **Add Listing: keep the heading on return.** When the agent comes back from media management in the creation workflow, the heading stays "Add listing" even though the draft now has an ID. Editing an existing listing still shows "Edit listing".
4. **Add Listing: scroll back on return.** Once the listing finishes loading, scroll to the target section, positioned below the sticky header. This runs once, then clears the scroll target so a page refresh doesn't scroll again.
5. Add a stable section id to the Floor Plans block if it doesn't have one, for example `section-floorplans`.

## What stays the same
- Save & Return still saves only the photo or floor-plan changes, using the same save code as today. It never touches status and never publishes, triggers Hot Sheets or runs first-publish behavior.
- The save that runs before leaving Add Listing is unchanged.
- No backend, email, Hot Sheet, publishing or status-logic changes.

## QA (Draft, nothing published)
1. Start on Add Listing and scroll to Property Photos.
2. Open Manage Photos, then click Save & Return.
3. Confirm the heading says "Add listing" and the page lands on Property Photos.
4. Repeat steps 1–3 with Manage Floor Plans; it should land on Floor Plans.
5. From an existing listing's Edit page, confirm Save & Return still goes to Edit Listing.
6. Confirm the listing is still Draft, with no new Hot Sheet events or email jobs.

## Technical details
- Origin travels as React Router `location.state`, e.g. `{ returnTo, returnState: { fromAddListing: true, scrollTo, from } }`. Files: `src/pages/AddListing.tsx` (the navigate handlers near line 3505, the title at line 4332, a section id and a scroll effect) and `src/pages/ManageListingPhotos.tsx` (line 211 and the back control).
- Scroll uses `scrollIntoView({ block: "start" })` with `scroll-margin-top` on the sections, so it works inside the AppShell's own scrolling area. After scrolling, the scroll target is cleared with `navigate(..., { replace: true })`.
