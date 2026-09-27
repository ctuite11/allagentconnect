# Add Listing cleanup

Scope: Add Listing page only. No changes to Hot Sheets, email, DCMLS rules, listing statuses, or the first-publish photo rule. Social checkboxes stay in the draft (not a regression).

## Step 0 — Regression audit (report before changing)
- **Preview:** the "Preview functionality coming soon" message has been in the Add Listing page since it was first created, so it may never have worked here. I will search the project history and other pages (e.g. the listing review page) for a working preview. If one exists, reconnect it. If not, report that and stop on this item. No new placeholder.
- **Publish confirmation:** the photo-order window replaced an earlier review window in a recent change. I will find the earlier version and bring its layout back.
- **Bottom buttons:** check whether a bottom action row used to exist.

## 1. DCMLS section highlight (visual only)
Stronger AAC-blue tinted background, blue border, and a heavier left accent bar on the "Show this listing on DCMLS" block. The checkbox and participation logic stay the same. This also changes the block on the Edit Listing page, because both pages share it.

## 2. New listing agreement option
Add "Exclusive Right to Sell — Buyer-Broker Compensation Offered" to the sale options. Existing options and saved data stay as they are. No "Variable Rate" wording.

## 3. Bottom Save Draft | Preview | Publish Listing
Add a final row after the last section. When that row is on screen, the sticky top bar hides. The top bar works as before everywhere else. All three buttons use the same actions as the top ones.

## 4. Preview
Handled based on the Step 0 findings.

## 5. "Ready to publish?" confirmation
Replaces the photo-order-only window:
- Cover photo, labeled "Cover Photo"
- Property address (bold), property type
- Beds | Baths | Sq ft
- Buttons: "Go Back / Edit" and "Yes, Publish Listing"

It keeps the same place in the publish flow, so the check for at least one fully uploaded photo still runs.

## Technical
- Files: `src/lib/listingAgreement.ts`, `src/components/listing/DcmlsPublishControl.tsx`, `src/pages/AddListing.tsx` (publishConfirm dialog ~L3589, preview handler L3244, action bar ~L3764).
- The bottom-row visibility uses an IntersectionObserver.
- Changes deploy through GitHub main, and I will report exact changes afterward.
