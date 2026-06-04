## Problem

The Resend button on the pending buyer card fails with "Failed to resend invite" when the original invite came from a hot sheet.

Root cause: `enqueueHotSheetClientInvites` was written for the first-time "Send Invites" flow. It skips any client that already has a `client_hotsheet_invite` share token (`sendDashboardInvite = !buyerLinkedCrmIds.has(clientId) && globalMerged.length === 0`). On a resend the token always exists, so the client is skipped and `enqueued === 0` → error toast.

## Fix

In `BuyerCard.handleResend` (`src/pages/success-hub/BuyersList.tsx`), stop using `enqueueHotSheetClientInvites` for the hot‑sheet path. Instead, invoke `send-hot-sheet-invite` directly with the existing token — the same pattern `HotSheetReview` uses for resend.

Flow when a `client_hotsheet_invite` share token with a `hot_sheet_id` exists for this buyer:

1. Already fetching it (`hotSheetToken`). Pull `id` (tokenId) and `payload.hot_sheet_id`.
2. Load the hot sheet name from `hot_sheets` (already doing this).
3. Load the agent's display name from `agent_profiles` for `inviterName`.
4. Build `hotSheetLink` using `share_tokens.token` (need to also select `token` in the query) with the same query-string shape used elsewhere (`/client-invite?invitation_token=…&email=…&agent_id=…&client_id=…&first_name=…&last_name=…`).
5. Call:
   ```ts
   supabase.functions.invoke("send-hot-sheet-invite", {
     body: {
       invitedEmail: buyer.email,
       inviterName,
       hotSheetName,
       hotSheetLink,
       hotSheetId,
       tokenId,
       clientId: buyer.clientId,
       mode: "resend",
     },
   });
   ```
6. On success, `kick-email-queue` and toast "Invite resent to …".

Fallback path (no hot sheet token) unchanged — still calls `enqueueBuyerWorkspaceInvite`.

## Notes / scope

- Pure frontend change in `src/pages/success-hub/BuyersList.tsx`. No edge function, schema, or other component edits.
- Selecting `token` from `share_tokens` is the only query change.
- Existing pill + button styling and the workspace-invite fallback stay as-is.
