## Problem

For Hot Sheet Review comments, even when the buyer has accepted the invite and has a CRM email/phone, the comment click hits the "no contact info — add email before inviting" branch.

Root cause is in `src/lib/resolveHotSheetReviewConversationBuyer.ts`:

- All resolution paths (share_tokens, client_agent_relationships, email→profiles) end up routed through `profileIdExists(authId)` or `resolveBuyerAuthUserId({ email })`.
- Both depend on the agent being able to `SELECT` from `public.profiles` for a **different user**.
- Current `profiles` RLS (verified in DB):
  - `profiles_select_own` / `Users can view their own profile`: `auth.uid() = id`
  - No policy lets an agent read a buyer's profile row.
- So `profileIdExists` returns false for any buyer auth id, `resolveBuyerAuthUserId` returns null for any buyer email, and the resolver collapses to "no buyer auth user → invite flow → no email" path.

This also explains why the dialog then surfaces the "no email" error even though the CRM client has one — the `clients` table read happens in the **same** unresolved branch and the buyer's CRM row is found via a different code path (`reviewRecipients`) that already had the email; control flow just never reaches there for some configurations.

## Goal

Make buyer auth resolution succeed without requiring the agent to read `public.profiles` for another user. Trust the auth ids returned by tables the agent legitimately has access to.

## Scope

`src/lib/resolveHotSheetReviewConversationBuyer.ts` only. No schema migrations, no RLS changes, no UI changes, no edge functions.

## Changes — `src/lib/resolveHotSheetReviewConversationBuyer.ts`

1. **Remove the `profileIdExists` gate** from:
   - `resolveBuyerAuthFromAcceptedShareTokens` (line ~86)
   - The accepted-share-tokens loop in `resolveHotSheetReviewConversationBuyer` (line ~243)
   - The `client_agent_relationships` loop (line ~222)

   Trust the `accepted_by_user_id` / `client_id` values returned by these agent-owned tables. They are already validated at write time (FKs to `auth.users`).

2. **Delete the now-unused `profileIdExists` helper.**

3. **Replace `resolveBuyerAuthFromCrmClientId` email-only path with a wider net.** New order, all using tables the agent can read:
   1. `share_tokens` (agent-owned) — accepted_by_user_id where payload.client_id matches.
   2. `client_agent_relationships` (agent-owned) — `client_id` where `crm_client_id` matches, `status='active'`.
   3. **NEW:** `buyer_workspace_invites` — `accepted_by_user_id` (or equivalent column) where `buyer_email` matches the CRM client email, `accepted_at IS NOT NULL`. Confirm exact column names against the table before the read; if the table is unreadable by the agent, skip silently.
   4. Last-ditch: `resolveBuyerAuthUserId({ email })` (kept as a soft fallback for when admin/service contexts call this).

4. **`resolveBuyerAuthForHotSheet`** keeps its existing shape (`{ authUserId, hasAnyInvite, hasPendingInvite }`). After the new chain returns null, the "any/pending invite" probe stays as-is (still queries `share_tokens` for the agent — accessible).

5. **Diagnostic log unchanged** in dev mode so future regressions are visible in the existing `[HotSheetReview] conversation buyer resolution` payload.

## Out of scope (do NOT touch)

- `src/pages/HotSheetReview.tsx` flow, dialogs, or toasts.
- `src/lib/resolveBuyerAuthUserId.ts` signature.
- RLS migrations on `profiles`.
- Invite, email, or conversation_messages logic.

## Verification

1. `npm run build`.
2. In the live preview as the agent, click Comment on the listing card for the accepted buyer; the ListingConversationSheet should open instead of the invite/contact-info dialog.

## Technical notes

- The DB has been confirmed: profiles RLS is owner-only (`auth.uid() = id`). `share_tokens.agent_id = auth.uid()` and `client_agent_relationships.agent_id = auth.uid()` are readable by the agent, so values returned from those tables are safe to trust without re-validating against `profiles`.
- `buyer_workspace_invites` column names (`accepted_by_user_id` vs another) must be checked before the read is added; if absent, omit step 3.3 rather than fabricate columns.
