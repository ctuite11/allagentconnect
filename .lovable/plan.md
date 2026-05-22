## Goal

When an agent picks **Send Invite with Hot Sheet** after adding a buyer, the flow should land on the Hot Sheet review page so they can verify the matched listings, remove unwanted ones, and only then send the invite — instead of the invite being sent the moment the sheet is created.

## Current behavior (the bug)

1. Add Buyer → "Send Invite with Hot Sheet" → navigates to `BuyerAccount` with `?createHotSheet=1`.
2. `CreateHotSheetDialog` opens with `lockedToClient`. On save it:
   - creates the hot sheet
   - **immediately calls `enqueueHotSheetClientInvites(...)`** (file `src/components/CreateHotSheetDialog.tsx`, lines ~978–1003), which fires the buyer's invite email with sample listings.
   - then navigates to `/hot-sheets/:id/review`.
3. By the time the agent reaches the review page (where listing removal lives), the email has already been queued.

`HotSheetBuyerDetail.tsx` uses the dialog the same way (also navigates to review on success), so removing auto-send is consistent across both entry points. The review page already has a `Send Invites` action and a "Removed listings" panel — no changes needed there.

## Plan

### 1. Stop auto-sending invites from `CreateHotSheetDialog`

File: `src/components/CreateHotSheetDialog.tsx`

- Remove the `lockedToClient && createdHotSheet && selectedClients.length > 0` block that calls `enqueueHotSheetClientInvites` and `kick-email-queue` (lines ~978–1003).
- Replace it with a simple `toast.success("Hot sheet created. Review the matches and send the invite when ready.")`.
- Drop the now-unused `enqueueHotSheetClientInvites` import if nothing else in the file uses it.
- Update the dialog's helper copy at lines ~1127–1129 and ~2074–2079 so it no longer promises that confirming "sends the invite email"; instead it tells the agent: "We'll save the hot sheet and open the review page so you can confirm matches before sending."

### 2. Keep navigation as-is

- `BuyerAccount.tsx` and `HotSheetBuyerDetail.tsx` already navigate to `/hot-sheets/:id/review` on `onSuccess`. No change.
- On the review page the agent sees matched listings, can remove any (existing functionality), then clicks **Send Invites** — which is the only place the invite email gets queued.

### 3. Light copy tweak on the "Buyer Added" dialog (optional, non-blocking)

File: `src/components/success-hub/BuyerCreatedNextStepDialog.tsx`

- Change the secondary line under "Send Invite with Hot Sheet" so it accurately reflects the new flow, e.g. _"Set criteria, review matches, then send"_ — keeps the user from expecting an instant send.

## Out of scope

- No changes to `HotSheetReview.tsx`, `enqueueHotSheetClientInvites.ts`, edge functions, schema, or RLS.
- No change to the "Invite Client Now" path (workspace-only invite, no hot sheet) — it stays as-is.
- Bulk/multi-client hot sheet flows already route through review and are unaffected.

## Files touched

- `src/components/CreateHotSheetDialog.tsx` — remove auto-invite block, update copy.
- `src/components/success-hub/BuyerCreatedNextStepDialog.tsx` — minor subtitle tweak.
