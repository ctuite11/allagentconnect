## Correction plan

Your rule is correct: when an agent removes a buyer, that buyer’s access/invite state must be treated as ended. If the agent later adds the same person again, the app must create a new invite and the buyer must accept it again.

## Root cause found

- The removal function deletes the buyer’s hot sheets and marks the relationship inactive, but it only revokes pending invite tokens.
- Accepted old invite tokens can remain active even when their hot sheet was deleted.
- The invite UI then sees that old accepted/non-revoked token by email and incorrectly decides: “this buyer was already invited / no invite needed.”

## What I will change

1. **Fix buyer removal cleanup**
   - Update the buyer-removal database function so removal revokes all hot sheet invite tokens for that agent + buyer email/client, including previously accepted tokens.
   - Keep historical rows for audit, but mark them inactive via `revoked_at` so they no longer grant access or block future invites.

2. **Ignore orphaned invite history**
   - Update invite eligibility checks so they only consider non-revoked tokens tied to existing/current hot sheets.
   - Old tokens for deleted hot sheets will no longer count as “already invited.”

3. **Force fresh invite after re-add**
   - Update `HotSheetReview.tsx` and `enqueueHotSheetClientInvites.ts` so a newly-added buyer with no active accepted relationship for the current lifecycle gets a new token/email, even if the same email had an old accepted invite before removal.

4. **Backfill the broken current data**
   - Revoke existing stale/orphaned invite tokens where the referenced hot sheet no longer exists, including the lingering accepted token that is blocking this buyer.
   - This makes the current n.lopach case eligible for a fresh invite immediately.

5. **Validate the send path**
   - Confirm that the new invite is queued with a new token and that selected listings are not sent until the buyer accepts the new invite.