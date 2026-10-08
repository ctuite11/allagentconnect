# Why the last Hot Sheet invite did not send (read-only findings + proposed fix)

## What happened (Oct 8, 14:43 UTC)
- Hot Sheet "Buyer one boston condo's", buyer chris tuite (chris.tuite@compass.com). The buyer has no active relationship, so the button correctly read "Send First Batch & Invite".
- The 8 selected listings were saved as the buyer's first batch. That part worked.
- No invitation was created and no email was queued. The last email job is from Oct 8, 00:30, and it's a digest.

## Root cause
The same contact already has an **unaccepted, unrevoked invitation link created Oct 7, 03:58** for the Hot Sheet "dad". That Hot Sheet still exists. Yesterday's batch deletions removed only the pending batches, not this invite link.

The first-invite rule (`isFirstInviteEligible`) counts any live invite link for this buyer as "already invited", so the page silently skipped them. It also never falls back to re-sending, because the existing link belongs to a different Hot Sheet.

To check: no email was ever queued for the Oct 7 link either. The buyer has never actually received an invitation, but that link blocks every new one.

The stale-invite filter didn't help, because the "dad" Hot Sheet and the contact are not deleted.

## Options (choose one)
- **A. Data only (smallest):** revoke the single Oct 7 invite link (`8b022815…`). This is exact-ID and reversible. You then press Send again yourself. No code change.
- **B. Rule fix:** treat a live, unaccepted invite link that never produced an email as not blocking. This needs a matching update to the locked rule and test (`hotSheetRules.ts` and its test, same change). The silent skip should also show a visible message.

Either way, nothing is sent by me. The current batch row stays untouched.

## Webhook check
Paused. The read-only Resend webhook review is still ready to resume after this.
