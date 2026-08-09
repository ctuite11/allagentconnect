# Katie Malin — verification status check

## What the records show

There are **two** Katie Malin accounts:

| Account | Email | Created | Verified | Activated |
|---|---|---|---|---|
| A (current) | katherine.malin@gmail.**com** | Aug 9, 3:45 AM | Yes, Aug 9 3:45 AM | No |
| B (old, typo) | katherine.malin@gmail.**con** | Aug 4 | Yes, Aug 4 | No |

For account A, the verification/welcome email was created and accepted by the email provider at 3:46 AM today, and a 7-day activation link was issued (expires Aug 16). It has **not been opened/redeemed** yet.

So nothing failed. She shows "pending" because "pending" in the admin list means *pending activation* — she is license-verified, but hasn't clicked the activation link and set her password yet. Her status flips automatically the moment she does.

Account B is a dead duplicate created from a mistyped email address (`.con`). That address cannot receive mail, so it will never activate and will keep sitting in the list looking unresolved.

## Proposed actions

1. **Leave account A alone** — the link is valid until Aug 16. If she says she never received it, resend the activation link from her admin card rather than re-verifying.
2. **Remove the duplicate account B** (`katherine.malin@gmail.con`) — delete its pending verification, agent profile, settings, and auth user so only the real account remains in Admin Approvals and the Agent Network.

## Technical notes

- Activation state lives in `agent_settings.account_activated_at` (null for both) and `agent_activation_tokens` (token `1d111948…`, status `issued`, unredeemed).
- Deletion of account B would go through the existing admin delete path (`admin_delete_pending_verification` / `delete-users`), passing both the user id `0ce2414e-…` and the email, consistent with prior cleanups.
- No email retries, backfills, or re-sends would happen without explicit approval.
