# Populate buyer name on Create Password page after re-invite

## Problem

When an agent removes a buyer and later re-adds them, the new hot sheet invite email leads to the Create Password page with empty First/Last name fields. The accept page (`ClientInvitationSetup.tsx`) already reads name seeds from two sources:

1. URL params `first_name` / `last_name`
2. `share_tokens.payload.client_first_name` / `client_last_name`

…but two of the three invite-creation paths don't write those fields, so re-invites land on the page blank.

## Root cause

- `src/lib/enqueueHotSheetClientInvites.ts` — already includes the names in payload + URL. ✅
- `src/pages/HotSheetReview.tsx` (`handleSendInvites`, around lines 822-957) — selects only `email, first_name, last_name` from `clients`, but stores **only** `client_email` in the token payload and omits `first_name` / `last_name` from both the payload and the invite URL. ❌
- `src/pages/HotSheetBuyerDetail.tsx` (`handleResendInvite`, around lines 195-248) — token payload and URL omit name fields entirely. ❌
- `supabase/functions/process-hot-sheet/index.ts` (around lines 374-389) — token payload omits name fields. ❌

## Plan

1. **`src/pages/HotSheetReview.tsx`**
   - Extend the `clients` select to include `phone`.
   - Extend the `clientMap` entries to keep `first_name`, `last_name`, `phone`.
   - When inserting a new `share_tokens` row, add `client_first_name`, `client_last_name`, `client_phone` to the payload.
   - Append `&first_name=…&last_name=…` (when present) to the `hotSheetLink`, matching `enqueueHotSheetClientInvites`.

2. **`src/pages/HotSheetBuyerDetail.tsx`**
   - Where the buyer record is loaded for this page, ensure first/last name and phone are available (most likely already on `buyer`).
   - When inserting a fresh `share_tokens` row in `handleResendInvite`, include `client_first_name`, `client_last_name`, `client_phone` in the payload.
   - Append `first_name` / `last_name` query params to `hotSheetLink` when present.

3. **`supabase/functions/process-hot-sheet/index.ts`**
   - When the email comes from the junction-table `clients` row, also pull `first_name`, `last_name`, `phone` and add `client_first_name`, `client_last_name`, `client_phone` to the new token payload.

4. **Verify**
   - Re-add a previously-removed buyer (e.g., `n.lopach`), send a hot sheet invite, open the email link, confirm First/Last fields are pre-filled on the Create Password page.
   - Confirm existing flows that already populate names (URL params, accepted invites) continue to work.

## Out of scope

- No UI/visual changes to `ClientInvitationSetup`.
- No schema or RLS changes.
- No changes to the buyer removal/cleanup logic shipped previously.
