# Hot Sheet Review — connected-state fix

## Rule (one source of truth, matches the backend)
Connected = an active `client_agent_relationships` row for this buyer/contact and agent (status `active`, `ended_at` null, linked buyer account). No accepted invitation counts as connected by itself — including one accepted for the current Hot Sheet. This is the same condition `process-hot-sheet` uses (confirmed read-only: it checks active relationships only).

## Expected behavior
- Active relationship → **Send First Batch**
- No active relationship → **Send First Batch & Invite**

## Changes
- `src/pages/HotSheetReview.tsx` (~645): `buyerConnected = buyerLinkedCrmIds.has(cid)`; `inviteAccepted: buyerConnected` drives the pending/connected split and button label. Old email-matched accepted invites and workspace invites no longer mark a buyer connected.
- `src/lib/resolveHotSheetReviewConversationBuyer.ts` (`fetchActiveRelationshipsForCrmClients`): added `.is("ended_at", null)` so the page's relationship query matches the backend exactly.

## Verified (no sends)
- "Buyer 1 Boston Condo's" and "sdfdsafdsa" both show **Send First Batch & Invite** with the pending-buyer instruction — correct: the database shows zero active relationships for this agent, so both buyers are genuinely pending.
- Email queue unchanged at 16,528; zero emails/invites created; build OK.

## Constraints
- The two waiting batches ("Buyer 1 Boston Condo's" 8 IDs, "kerri" 62 IDs) stay untouched.
- No Send pressed; no real invitation test until explicitly approved.
- The stale-May-invite/reminder issue stays read-only: the stale May 16 accepted token keeps `globalMerged` non-empty for chris.tuite@compass.com, so a new invite for this buyer would be treated as a resend/reminder, not a first invitation (HotSheetReview.tsx and `enqueueHotSheetClientInvites.ts:152`). No fix until a real invitation test is approved.
