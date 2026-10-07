# Hot Sheet Review — connected-state fix (DONE 2026-10-07)

## Rule (one source of truth)
Connected = an active buyer–agent relationship (`client_agent_relationships`, status `active`, `ended_at` null, linked `client_id`) for this CRM contact and agent — identical to `process-hot-sheet`. No accepted invitation counts by itself, including one for the current Hot Sheet.

## Changes
- `src/pages/HotSheetReview.tsx` (~645): `buyerConnected = buyerLinkedCrmIds.has(cid)`; `inviteAccepted: buyerConnected` drives the pending/connected split and button label. Old email-matched accepted invites and workspace invites no longer mark a buyer connected.
- `src/lib/resolveHotSheetReviewConversationBuyer.ts` (`fetchActiveRelationshipsForCrmClients`): added `.is("ended_at", null)` so the frontend relationship query matches the backend exactly.

## Verified (no sends)
- "Buyer 1 Boston Condo's" and "sdfdsafdsa" both show **Send First Batch & Invite** with the pending-buyer instruction — correct: the database shows zero active relationships for this agent, so both buyers are genuinely pending.
- Email queue unchanged at 16,528; nothing sent; build OK.

## Read-only finding: stale-invite reminder risk
`sendDashboardInvite = !buyerConnected && globalMerged.length === 0` (HotSheetReview.tsx and enqueueHotSheetClientInvites.ts:152). The stale May 16, 2026 accepted token (deleted contact/Hot Sheet) keeps `globalMerged` non-empty for chris.tuite@compass.com, so a new invite for this buyer would be treated as a resend/reminder, not a first invitation. Not fixed — awaiting decision before any real invite test.

## Not done
- No real invitation sent; the two waiting batches ("Buyer 1 Boston Condo's" 8 IDs, "kerri" 62 IDs) untouched.
