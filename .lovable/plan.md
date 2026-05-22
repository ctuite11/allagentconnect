## Plan

1. **Separate “invite” from “send selected listings”**
   - Update `HotSheetReview.tsx` so the primary action can still send selected listings even when the buyer does not need a new dashboard invite.
   - Keep the invite creation/resend logic only for buyers who actually need or can receive an invite.

2. **Send listings after invite handling**
   - After invite emails are queued, call the existing `process-hot-sheet` flow with `sendInitialBatch: true` and the selected listing IDs.
   - If no invite is needed, skip invite queueing and send the selected listings directly instead of showing “No new search invitations needed.”

3. **Fix accepted-buyer delivery guard**
   - Update `process-hot-sheet` so accepted invite detection ignores revoked tokens by selecting `revoked_at` and filtering it out.
   - This prevents old removed-buyer tokens from influencing whether selected listings can be sent.

4. **Improve the user-facing message**
   - Replace the misleading “No new search invitations needed…” stop state with a success/info path that makes clear listings were sent or no new listings were available.

## Technical details

The remaining bug is in `HotSheetReview.handleSendInvites`: when `sendDashboardInvite` is false, it skips the buyer entirely and returns before sending selected listings. That is wrong for a buyer who already has access or does not need another invite. The fix is to treat dashboard invite eligibility as optional and keep selected-listing delivery as its own action.