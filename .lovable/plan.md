# Restore the full Publish flow (review + social) on Add Listing

## Why a Draft went live in one click (confirmed)
When a draft is reopened, the review check looks at its **chosen** status (for example On MLS) instead of its **real** saved status (Draft), decides it is already live, and skips the review. New rule: a listing whose real saved status is Draft is always a first publish.

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
8. The first-publish choices (including "none") are saved as that listing's social defaults, through a secure server step.
9. If any platform was picked, the post is sent and the page waits for the result. A failure says "Listing published, but the social post could not be completed." It never undoes or fails the publish.

## Step 3: Live listings being edited
- No "Ready to publish?" again on ordinary edits.
- On the approved eligible changes (status change, price change, etc.), a small social prompt appears with the listing's saved defaults pre-checked. Temporarily Withdrawn and Cancelled never prompt.

## Step 4: Launch gate and testing
- Social section only appears for accounts allowed today (you as admin and named test accounts); everyone else sees the normal review with no social section. The server still refuses others.
- Live test signed in as you on a clearly fake test draft: reopen it, click Publish, confirm the review appears, and confirm Go Back keeps it a Draft. I will stop and ask before any real "Yes, Publish Listing" click, because that can send Hot Sheet emails. Social posting is only tested after you connect an account.

## Not changing
Hot Sheet/email rules, DCMLS rules, statuses, the photo rule, social security settings, `social-publish-listing`, Rental form (no social there today).

## Technical details
- First publish: `backendStatusRef.current === "draft"` means first publish, regardless of `formData.status` or `draft_intended_status`. On hydration: `backendStatusRef` and `originalStatusRef` get the raw DB status; `formData.status` gets the restored intended status. `needsFirstPublishLiveConfirm` and the photo gate key off the real draft state, not `isLiveStatus(originalStatusRef)`, so old Expired/Cancelled listings aren't treated as never published.
- Extend (not rebuild) `ConfirmBeforePublishingDialog` with an optional social section (connected platforms, selected, onChange). Load via `social-accounts-status`; a 403 hides the section.
- New gated edge function `social-save-listing-defaults`: uses `authenticateGated` + `canActOnListing`, zod-validates four booleans (all-false allowed), upserts `listing_social_defaults` with the service role. Browser RLS/grants unchanged (read-only for users).
- After confirmation: (1) live write succeeds and is final; (2) call the defaults function; (3) if at least one platform is selected, await `social-publish-listing` in its own try/catch with one `clientRequestId` per publish attempt, reused on retry; toast success or "Listing published, but the social post could not be completed." All-unchecked skips the post.
- Edit-time prompt: small dialog after save for eligible events, pre-filled from `listing_social_defaults`; same defaults/post sequence.
- Step 1 report lists the draft's actual files/components (Settings connection card, Promote This Listing, publish-time selections, defaults, open-house controls, edit prompts) as found, not assumed. Only approved pieces are rebuilt on main.
- Files: `src/pages/AddListing.tsx`, `ConfirmBeforePublishingDialog.tsx`, new social prompt component, new `supabase/functions/social-save-listing-defaults`. Saving to GitHub main makes it live on allagentconnect.com immediately.
