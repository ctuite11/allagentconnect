## Scope

Single-line label change on the primary Send button in `src/pages/HotSheetReview.tsx` (around line 1163). Nothing else touched — no logic changes, no other files, no styling changes elsewhere.

## Change

The primary blue Send button currently always reads **"Send Listings"**. Update the label to reflect invite state using the existing `unacceptedCount` and `acceptedCount` variables already computed in the file:

- `unacceptedCount > 0` → **"Send Listings with Invite"** (new buyer, hot sheet shared for the first time, invite rides along)
- `unacceptedCount === 0 && acceptedCount > 0` → **"Send Listings"** (buyer has already accepted; future sends are just listings)
- While sending → **"Sending…"** (unchanged)

```tsx
{sending
  ? "Sending…"
  : unacceptedCount > 0
    ? "Send Listings with Invite"
    : "Send Listings"}
```

## Confirming what I am NOT touching

- No change to `handleSendInvites` send/skip logic.
- No change to the "Notify Clients" dropdown that appears once everyone has accepted.
- No change to the confirm dialog, recipient rows, or send-invite edge function.
- No change to the BuyersList / HotSheetBuyerDetail work from the previous turn.

Confirm and I'll ship.