# Align Hot Sheet Review chat-open with Favorites buyer resolution

## Why
On `AgentClientFavorites`, opening a listing discussion **always works** because the page resolves the buyer with a single, direct lookup:

```
clients.id  →  clients.email  →  profiles.email  →  profiles.id   (= buyer auth uid)
```

That's it — no `share_tokens`, no `client_agent_relationships`, no `buyer_workspace_invites`. The RLS on `profiles` already permits this `email →  id` read for the agent (Favorites proves it).

In `HotSheetReview.onOpenChat`, the same buyer would resolve fine with that one query, but instead we run a multi-stage chain (`resolveBuyerAuthForHotSheet` → share_tokens → workspace_invites → relationships → CRM email). When the early stages each return `null` (RLS-gated tables, payload mismatches, etc.) we fall through to a final branch that fires:

> "This buyer has no contact info — add an email before inviting."

…even though the buyer has an email AND has accepted the invite. Favorites would have resolved them on the first try.

## What to change

**File:** `src/pages/HotSheetReview.tsx` — only the `onOpenChat` handler around lines 1387–1465.

Replace the multi-step resolver chain with the Favorites pattern, in this order:

1. If `getConversationBuyerUserId()` already returns an id, use it (unchanged).
2. Build the candidate CRM client id list (same as today: `buyerContextClientId`, `hotSheet.client_id`, then any `reviewRecipients[].clientId`).
3. For each candidate CRM id, in order:
   - Read `clients.email` for that id.
   - If email present, call `resolveBuyerAuthUserId({ email })` (the exact function Favorites uses).
   - First non-null result wins → `applyConversationBuyerUserId(...)` and open the chat.
4. Only if **every** candidate has no email (or no matching `profiles` row) do we fall through to the existing Invite/Resend dialog branch.

Drop the call to `resolveBuyerAuthForHotSheet` from this handler. The initial-load resolver at line 537 (`resolveHotSheetReviewConversationBuyer`) stays as-is — it pre-populates `conversationBuyerUserId` for the common case; this change only fixes the on-demand fallback when that pre-pop returned `null`.

## What stays the same
- No DB changes, no RLS changes.
- `resolveHotSheetReviewConversationBuyer` (page-load resolver) is untouched.
- The Invite/Resend dialog still fires when there genuinely is no email anywhere.
- No styling, layout, or other UI changes.

## Expected outcome
Clicking the comment button on a Hot Sheet Review listing card behaves identically to clicking it on the Favorites page: the buyer is resolved by email-to-profile and the conversation sheet opens. The misleading "no contact info" toast no longer fires for buyers who actually have an email.
