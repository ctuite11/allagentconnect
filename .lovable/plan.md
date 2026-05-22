## Plan

1. **Patch the programmatic hotsheet invite path**
   - Update `src/lib/enqueueHotSheetClientInvites.ts` so it reads `revoked_at` from `share_tokens`.
   - Ignore revoked hotsheet invite tokens when building agent-wide “already invited” eligibility.
   - Ignore revoked tokens when looking for an existing token for the current Hot Sheet.

2. **Keep the already-fixed review page behavior aligned**
   - Leave `HotSheetReview.tsx` unchanged except only if a direct mismatch is found during implementation.
   - The page already ignores revoked tokens in the visible “Send Listings with Invite” flow.

3. **Validate the fix**
   - Verify the helper no longer treats revoked tokens from a previously removed buyer as active.
   - Confirm a removed-and-readded buyer can receive a fresh invite instead of being skipped as “already invited.”

## Technical details

The current failure is in `enqueueHotSheetClientInvites.ts`: it selects `id, token, payload, accepted_at` but not `revoked_at`, then includes every historical `client_hotsheet_invite` token in both global eligibility and same-sheet token reuse. That means revoked tokens from a removed buyer can still make `sendDashboardInvite` false and skip the new invite. The fix is to mirror the `HotSheetReview.tsx` logic by filtering out `revoked_at` tokens before any eligibility or resend decision.