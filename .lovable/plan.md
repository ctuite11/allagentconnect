# Restore the full Publish flow (review + social) on Add Listing

## Why a Draft went live in one click (confirmed)
When a draft is reopened, the page remembers its **chosen** status (for example On MLS) as if it were the listing's **real** status. The "Ready to publish?" check then thinks the listing is already live and skips the review. This came in with the "remember the draft's chosen status" fix. Brand-new listings are not affected; reopened drafts are.

## Step 1: Report first (no changes)
List exactly what social screens and code exist in the separate social draft (settings connection card, "Promote This Listing" choices, publish-time social step, listing defaults) and what must be carried over. Nothing from that draft is merged as-is; it is rebuilt on today's version so none of the recent fixes are lost (Save Draft and remembered status, Preview/Back, photo check, review popup, DCMLS controls, bottom buttons, Withdrawn cleanup).

## Step 2: One controlled first-publish sequence
For any listing whose real saved status is Draft (new or reopened):
1. Agent clicks Publish
2. Required fields checked
3. At least one finished photo required
4. "Ready to publish?" shows status, address, property type, beds, baths, sq ft, price, cover photo
5. In the same popup, a social section: connected Facebook / Instagram / LinkedIn / Threads with checkboxes. Not-connected platforms are shown as not connected. Agent may uncheck all and publish without social.
6. "Yes, Publish Listing" makes it live. "Go Back / Edit" or closing leaves it a Draft with nothing saved as live.
7. Hot Sheets/emails run from the live listing as today.
8. After the listing is saved live, the chosen social posts are sent. A social failure shows a message but never undoes or fails the publish.
9. The first-publish choices are saved as that listing's social defaults.

## Step 3: Live listings being edited
- No "Ready to publish?" again on ordinary edits.
- On the approved eligible changes (status change, price change, etc.), a small social prompt appears with the listing's saved defaults pre-checked. Temporarily Withdrawn and Cancelled never prompt.

## Step 4: Launch gate and testing
- Social section only appears for accounts allowed today (you as admin and named test accounts); everyone else sees the normal review with no social section. The server still refuses others.
- Live test signed in as you on a clearly fake test draft: reopen draft, click Publish, confirm the review appears, Go Back keeps it a Draft, then confirm. **Heads-up:** confirming publishes the test listing for real (Hot Sheet emails could go out to matches). I will ask you before that final click, and social posting will only be tested once you've connected an account.

## Not changing
Hot Sheet/email rules, DCMLS rules, statuses, the photo rule, the social backend, Rental form (no social there today).

## Technical details
- Root cause: `loadExistingListing` sets `originalStatusRef.current = normalizedStatus` (the restored intended status); `needsFirstPublishLiveConfirm` reads it. Fix: gate on `backendStatusRef.current === "draft"` (real DB status) — always confirm when the DB row is draft; set `originalStatusRef` from the raw status.
- Extend `ConfirmBeforePublishingDialog` with an optional social section (props: connected platforms, selected, onChange). Load via `social-accounts-status`; a 403 hides the section.
- After successful live write in `handleConfirmPublish` path: upsert `listing_social_defaults`, then fire-and-forget `social-publish-listing` with a `clientRequestId` per publish attempt; toast result.
- Edit-time prompt: small dialog after save for eligible events, pre-filled from `listing_social_defaults`.
- Files: `src/pages/AddListing.tsx`, `src/components/add-listing/ConfirmBeforePublishingDialog.tsx`, new small social prompt component. Saving to GitHub main makes it live on allagentconnect.com immediately.
