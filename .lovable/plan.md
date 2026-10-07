# Stale invitation trace (read-only findings + smallest safe fix proposal)

No code was changed. No invitations or emails were sent. The two waiting batches were not touched. The connected-state fix stays as it is.

## Correction to the earlier description

The old May invitation does not turn the new invitation into a reminder. **It stops the invitation completely.** If any old, non-revoked Hot Sheet invitation from this agent exists for the same email, the page marks the buyer "not eligible for a first invite". When Send First Batch & Invite is pressed, that buyer is skipped (counted as `skippedDashboardIneligible`). No invitation email is queued. The batch is stored but stays locked, because the buyer never gets a link to accept.

A reminder (`mode = "resend"`) only happens when an unaccepted invitation already exists **for this same Hot Sheet**. That is a separate, correct path.

## 1. When the email-matched logic was added

- **2026-05-08**, commit `6c330413e` "Refine hot sheet review selection and invite logic": added `mergeGlobalInviteTokens` (matches tokens by contact ID **or by email** across all of the agent's Hot Sheets) to the review page, and the rule `sendDashboardInvite = not connected AND globalMerged is empty`. The goal was a "one-time dashboard invite per buyer".
- **2026-05-12**, commit `423593b60` "Send hot sheet invites from buyer create flow": copied the same logic into `src/lib/enqueueHotSheetClientInvites.ts`.
- **2026-06-20**, commit `39eeeff57`: changed the button wording for connected buyers. It did not change the email matching.

The May 16 token was created 8 days after the rule was added. It now matches the new contact by email.

## 2. Every place it is used now

| Place | Use | Effect today |
|---|---|---|
| `HotSheetReview.tsx` ~line 631 `globalMerged` | `sendDashboardInvite = !buyerConnected && globalMerged.length === 0` | Decides whether this buyer gets an invite on send |
| `HotSheetReview.tsx` ~633 `inviteAcceptedGlobally` | Passed into the status/badge helper (`inviteAcceptedForClient`) | Only affects the status label; no longer decides "connected" |
| `HotSheetReview.tsx` ~652 `pickPendingTokenRow(sheet tokens, or else globalMerged)` | Chooses which token to reuse for a reminder | Can pick a token from another Hot Sheet when this sheet has none |
| `HotSheetReview.tsx` send handler ~line 1010 / 1090 | Reads `sendDashboardInvite`; if false, skips the buyer | **This is where the invite gets dropped** |
| `src/lib/enqueueHotSheetClientInvites.ts` line 151 | Same rule | **No callers in the app today** (exported but never imported). It is inactive code with the same bug. |
| `process-hot-sheet` (backend) | Does **not** use it. It only counts accepted tokens for **this** Hot Sheet, and connection comes only from active relationships | Not affected |

## 3. Why the May 16 token still counts

The global lookup only filters `type = client_hotsheet_invite` and `revoked_at is null`. It does not check:
- whether the token's `client_id` still exists (the contact was deleted),
- whether the token's `hot_sheet_id` still exists (the Hot Sheet was deleted),
- whether the token belongs to the current contact at all (the email match pulls in tokens from other contacts).

Deleting the contact or Hot Sheet does not revoke its tokens, so the old token stays "live" for this check forever.

## 4. Could changing it affect other flows?

- Backend matching, delivery, cooldowns, dedupe and first-batch delivery: **no**. They don't read this rule.
- Connected buyers: **no**. `!buyerConnected` already blocks invites for them.
- Same-Hot-Sheet reminders: **no**, as long as reminders keep using tokens for this Hot Sheet.
- **Intended behavior that would change:** a buyer who has an unaccepted invite from **another live** Hot Sheet would be eligible for a new first invite on this one. Today that is blocked by the "one dashboard invite per buyer" rule. The smallest fix below keeps this behavior by only ignoring tokens whose contact **or** Hot Sheet has been deleted.
- `enqueueHotSheetClientInvites.ts`: no current callers, so no live effect. Fixing it too keeps the two copies the same.

## 5. Smallest safe fix (proposal — not applied)

In the global token lookup only (both copies), drop a token if it points to a deleted contact **or** a deleted Hot Sheet:
- Also load the agent's existing `clients.id` and `hot_sheets.id` (read-only, agent-scoped). The page already loads similar data.
- Filter `allInviteForAgent` so it only keeps tokens whose `payload.client_id` (if present) still exists **and** whose `payload.hot_sheet_id` (if present) still exists.

Nothing else changes: the connected rule, reminder selection for this Hot Sheet, the backend, templates, dedupe, the UI, and the waiting batches.

Expected result for "kerri" and "Buyer 1 Boston Condo's": no active relationship, and the only old token belongs to a deleted contact/Hot Sheet. So `sendDashboardInvite = true`, and pressing Send queues a **first** invitation (`mode = "initial"`), not a reminder and not a skip.

## Verification after approval (no sends)

1. Build passes.
2. Read-only: log or compute `sendDashboardInvite` for kerri, Buyer 1 Boston Condo's, and the connected test buyer, without pressing Send. Expect true, true, and false.
3. Confirm the `email_jobs` count stays at 16,528 and `share_tokens` is unchanged.
4. Stop. A real Send First Batch & Invite test needs separate approval.
