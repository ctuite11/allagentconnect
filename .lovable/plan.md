# Delete duplicate Katie Malin account (bad email)

## Records confirmed

Two accounts exist:

- **Keep** — katherine.malin@gmail.**com**, created Aug 9 3:45 AM, license verified 3:45 AM, welcome/activation email accepted by the provider at 3:46 AM, activation link issued and valid until Aug 16, not yet redeemed. This is why she reads as not-yet-activated: verification is done, setup is not.
- **Delete** — katherine.malin@gmail.**con** (typo domain), created Aug 4, verified Aug 4, never activated and never can be, since that address cannot receive mail.

## What will be removed for the bad account (user id `0ce2414e-…`)

- Pending verification row (Aug 4)
- Agent profile `AAC-0390`
- Agent settings row
- Auth user + role rows, via the existing admin delete path (passing both user id and email so nothing orphans)

Any leftover tombstone that would block re-inviting that person is cleared as part of the same pass.

## Not touched

- The good `.com` account, its verified status, and its outstanding activation link
- No emails re-sent, retried, or backfilled

## Verification after the delete

Re-query pending verifications, agent profiles, agent settings, and auth users for "malin" and confirm exactly one row remains — the `.com` account, verified, awaiting activation.
