## Goal

Make Hot Sheet Review listing comments work for any buyer that has a real workspace/auth account (even when their `profiles.email` differs from `crm_clients.email`), and replace the dead-end toast with an actionable "Invite / Resend invite" affordance when the buyer truly has no workspace account.

Scope is limited to Hot Sheet Review listing comment flow. Schema, email logic, and card visuals are untouched.

---

## Changes

### 1. Strengthen buyer auth resolution (option #3)

**File:** `src/lib/resolveHotSheetReviewConversationBuyer.ts`

Extend `resolveHotSheetReviewConversationBuyer` to try additional resolution sources before falling back to the CRM-email → `profiles` lookup. Order:

1. `client_agent_relationships.client_id` for the agent + CRM client (verified, already used).
2. **NEW:** `share_tokens.accepted_by_user_id` where the token's payload `client_id` matches one of the CRM client ids, the token is `accepted_at IS NOT NULL`, and `agent_id` matches the current agent.
3. **NEW:** `hot_sheet_clients` row for this hot sheet — if it carries an accepted buyer auth id (via the share_tokens join above) reuse it.
4. CRM email → `profiles.id` (existing fallback, exact + ilike).
5. Validate any candidate id with `profiles` existence check before accepting (already in place for relationship path; apply to new paths too).

Also export a thin helper `resolveBuyerAuthForHotSheet({ agentUserId, hotSheetId, hotSheetCrmClientId, recipients })` that the comment click handler can call on-demand without re-running the full debug pipeline.

`resolveBuyerAuthFromCrmClientId` keeps its current behavior; the click handler will additionally invoke the new helper when it returns null.

### 2. Replace dead-end toast with actionable invite UI (option #1)

**File:** `src/pages/HotSheetReview.tsx`

In the compact `ListingCard.onOpenChat`:

- If `getConversationBuyerUserId()` is null, run the strengthened resolver (step 1) once more.
- If still null:
  - **Do not** open `ListingConversationSheet`.
  - Open a small new `AlertDialog` ("Invite buyer to workspace") that:
    - Shows the buyer name + email (from `reviewRecipients` / `hotSheet.client_id` lookup).
    - Primary action label is **Invite buyer** when no token has been accepted, or **Resend invite** when an invite already exists but is unaccepted (decided from `reviewRecipients[].inviteAccepted` / `buyerLinked`).
    - Calls existing `enqueueBuyerWorkspaceInvite` (`src/lib/enqueueBuyerWorkspaceInvite.ts`) with the resolved agent id + buyer.
    - On success: toast "Invite sent to <email>", close dialog. (No queue-kick changes; reuse whatever the helper already does — we are not changing email logic.)
    - On error: toast the returned `error` string.
- Existing toast `"This buyer needs a workspace account before you can comment."` is removed in favor of this dialog.

If `getConversationBuyerUserId()` is non-null, behavior is unchanged — `ListingConversationSheet` opens against `conversation_messages` exactly as today.

### 3. Build verification

Run `npm run build` after changes and fix anything the new code breaks (only files we touched).

---

## Out of scope (explicitly not changing)

- `conversation_messages` schema or any messaging table.
- Email templates, queue, or notification logic.
- Agent-only / internal-note comments (deferred).
- ListingCard visual design beyond wiring `onOpenChat` to the new dialog when unresolved.
- Buyer Account / Favorites pages.
- Migrations.

---

## Technical notes

- `share_tokens` is already read elsewhere with anon RLS that lets the agent see their own tokens — query filters on `agent_id = agentUserId` to stay within existing policy.
- Helper returns `{ authUserId, hasPendingInvite, hasAnyInvite }` so the dialog can choose Invite vs Resend label without an extra query.
- Dialog component lives inline in `HotSheetReview.tsx` next to the existing `confirmInviteOpen` dialog to match local patterns. State: `inviteBuyerDialogOpen`, `inviteBuyerTarget`, `inviteBuyerSending`.
- Agent display name passed to `enqueueBuyerWorkspaceInvite` reuses existing `agentDisplayName` state already set in `fetchHotSheetAndListings`.
