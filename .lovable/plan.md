## Scope

`src/pages/HotSheetBuyerDetail.tsx` only. No other files, no behavior changes elsewhere.

## Change

In the buyer header card (line 470), the `trailing` slot currently renders just the "Pending" pill. When `relationshipStatus === "pending"`, render the pill **plus** a small "Resend invite" button beside it.

- Button reuses the existing `handleResendInvite(hs)` function (already in this file).
- Target hot sheet = most recent `hotSheets` entry where `invitePending === true`, sorted by `createdAt` desc. If none exists (edge case where the relationship is pending but no hot sheet was attached), the button is hidden.
- Disabled while `resendingHotSheetId` is set (matches the per-card behavior).
- Styling: small ghost/outline pill-style button with `RefreshCw` icon and "Resend invite" label, matching the per-hot-sheet card pattern at line 569.
- Active ("Searching") state is unchanged — no resend control.

No edits to `RelationshipStatusPill`, `handleResendInvite`, hot sheet cards, or any other surface.

Confirm and I'll ship.