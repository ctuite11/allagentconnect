## Scope

`src/pages/HotSheetReview.tsx` only. Adds a compact buyer strip and updates the Send button label while pending. No other files, no behavior changes.

## Changes

### 1. Send button label while pending

Currently:
- `unacceptedCount > 0` → "Send Listings with Invite"
- else → "Send Listings"

You asked whether it should say **"Resend Invite"** while pending. My recommendation: keep **"Send Listings with Invite"** for the first send and switch to **"Resend Invite"** only after the agent has already shipped at least one invite that is still unaccepted (i.e., the buyer was invited but hasn't opened/accepted). Mechanically that means: when **all** unaccepted recipients have a `resendTokenId` already on their `ReviewRecipient` row (token exists → invite was previously sent), label = "Resend Invite". Otherwise "Send Listings with Invite". Once everyone has accepted → "Send Listings".

If you'd rather it say "Resend Invite" any time any recipient is pending, say the word and I'll simplify.

### 2. Buyer strip with name + status + presence dot

Add a thin row directly under the hot sheet name header (between line 1039 and the Search criteria card at 1042). For each entry in `reviewRecipients`, render:

- **Avatar** — reuse `<AgentAvatar size="sm" name={displayName} headshotUrl={null} userId={authUserId} showPresence />`. The green online dot only appears for accepted ("Searching") buyers because they have an `auth.users` id; pending invitees have no `userId`, so no dot — matches your project standard.
- **Name** — `displayName`.
- **Status pill** — reuse `<BuyerRowStatusPill buyer={{ status: inviteAccepted || buyerLinked ? "active" : "pending", buyerWorkspaceLinked: buyerLinked }} />`. That renders "Pending Invite" (clock, neutral) or "Searching" (check, emerald).

Layout: horizontal pill row with `flex flex-wrap gap-2`, each chip `bg-white border border-neutral-200 rounded-full px-2 py-1`. Single line on desktop, wraps on narrow viewports. Shared-workspace mode (`isSharedWorkspace`) hides the strip — buyer is implicit.

To get the auth `user_id` for the presence dot, extend the existing recipient build (around line 434 in `fetchHotSheetAndListings`): pull `client_agent_relationships.client_id` (auth uid) joined by `crm_client_id` for accepted/active rows and stash it on `ReviewRecipient` as `authUserId?: string`. No extra round trip — the existing relationship query already loads.

## Confirming what I am NOT touching

- No edit to `handleSendInvites` send/skip logic.
- No edit to the Notify Clients dropdown (post-accept flow).
- No edit to BuyersList, HotSheetBuyerDetail, or the confirm dialog.
- No new components — reuses `AgentAvatar` and `BuyerRowStatusPill`.

Confirm and I'll ship.