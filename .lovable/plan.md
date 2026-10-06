# Fix: new Hot Sheet → first batch sends to the attached buyer (no contact picker)

## What's happening now (trace)
1. Saving a new Hot Sheet does go to the correct Hot Sheet page (Review Matches), and the buyer is linked to it. The Hot Sheet and buyer are not lost.
2. That page reuses the generic Listing Search results layout. That layout includes a **"Share selected"** button that opens the generic **Share Listings** window, and that window always asks you to pick a contact.
3. The page's own Hot Sheet send button ("Send Hot Sheet" / "Send Hot Sheet with Invite") only works in one case: the buyer **has not yet accepted** an invite. If the buyer already has AAC access, or an invite went out before, the page assumes the Hot Sheet was already sent. It then shows a greyed-out **"Hot Sheet Sent"** and switches on the generic "Share selected" button.
4. The result: for a brand-new Hot Sheet whose buyer is already connected (or was invited before), the only way to send is the generic share. That share asks for the contact again. This matches what you recorded.

## Fix (only on the Hot Sheet Review page)
- **On every Hot Sheet Review page, replace the generic "Share selected" button with one Hot Sheet send button.** It sends the selected listings to the buyer or buyers already linked to this Hot Sheet. There is no contact picker.
- Button label:
  - Buyer has no AAC access yet: **"Send Listings & Invite"**. This sends the selected listings plus the buyer invitation, using the existing invite send.
  - Buyer already has access: **"Send Listings"**. This sends the selected listings only, with no new invitation, using the existing first-batch send.
  - Both kinds of buyer on one Hot Sheet: each buyer gets the right version.
- **"Hot Sheet Sent" will only show after this Hot Sheet's first batch has actually gone out.** It will no longer show just because the buyer is connected or was invited for another Hot Sheet. You can still send more selected listings afterward with the same button.
- The button stays greyed out until at least one listing is selected. If the buyer has no email, it stays greyed out and tells you to add one.
- The Hot Sheet name, buyer and search criteria stay as they are on this page.

## Not changing
- The normal Listing Search share and its contact picker.
- How Hot Sheets match listings, send alerts, or format emails (templates stay frozen).
- How invites are created, plus the delete/end-relationship and household (shared) views.

## QA (no real sends)
- As Chris, create a test Hot Sheet for a test contact and confirm it lands on Review Matches with the buyer shown.
- Confirm there is no "Share selected" button, and that the correct send label shows for a not-yet-invited buyer and for an already-connected buyer.
- Do **not** press send. Delete the test Hot Sheet afterward. No emails or invites.

## Technical details
- `src/pages/HotSheetReview.tsx`: pass `shareSelectedEnabled={false}` to `AgentSplitResultsSurface` and put the Hot Sheet send button in `toolbarActionsExtra`. Route the click to `handleSendInvites()` for pending recipients and `sendSelectedListingsDirect()` for connected ones, both already in the file.
- Fix the `inviteCta` logic so "sent" depends on a first-batch or initial send record for this `hot_sheet_id`, not `allInviteAccepted` alone. Read-only check: confirm which record (`hot_sheet_sent_listings` or `invite_events`) reliably marks the initial batch before building.
- `AgentSplitResultsSelectionActions` / `BulkShareListingsDialog` stay unchanged.
