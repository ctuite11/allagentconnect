# Setup link won't send — root cause found

## What is actually failing

The Resend setup email call returns **422** from `send-license-verified-email`. That status means the database issuance routine refused to mint a token, so no email job is ever created. Confirmed in the edge logs (POST 422 at 21:30:41, plus a POST 404 at 21:36:46 from a row whose id has no auth user).

The chain:

```text
Admin clicks "Send setup link"
  -> send-license-verified-email (acknowledgeDeleted: true, passes the function-level guard)
  -> issue/reissue_agent_activation_token
  -> activation_issue_core
  -> agent_is_activation_eligible(user_id)  ->  FALSE
  -> status "ineligible" -> 422 -> toast "Could not send setup email"
```

`agent_is_activation_eligible` returns false for one reason here:

```sql
IF EXISTS (SELECT 1 FROM public.deleted_users d WHERE lower(d.email) = _email)
  THEN RETURN false;
```

Christie's address is in `deleted_users` from the July 22 bulk deletion. Her new account is fully valid otherwise: `agent_status = 'verified'`, `account_activated_at` null, `agent` role present, auth user active, pending verification not rejected.

So `acknowledgeDeleted` only bypasses the guard inside the edge function. The database gate has no equivalent override, and it wins. Any agent who was ever deleted and later re-verifies is permanently unable to receive a setup link. That is the bug.

## Fix

Two parts. Part 1 unblocks Christie today; Part 2 stops the next one.

**Part 1 — unblock Christie (data, one row)**
Remove her stale `deleted_users` tombstone for `xie.christie@gmail.com` (original user `d302d053-…`, deleted July 22). That record describes an account that no longer exists and has been legitimately re-registered. After that, click Send setup link in Admin Approvals; it will mint the token and enqueue one transactional email.

**Part 2 — make the admin override actually work (migration)**
Add an explicit override parameter so an acknowledged admin action can pass through the database gate:

- `agent_is_activation_eligible(_user_id, _allow_previously_deleted boolean default false)` — skip only the `deleted_users` check when true. Every other gate (deleted/banned auth user, rejected verification, wrong status, already activated) stays enforced.
- Thread a `p_allow_previously_deleted` argument through `activation_issue_core`, `issue_agent_activation_token`, and `reissue_agent_activation_token`.
- Pass the already-computed `acknowledgeDeleted` value from `send-license-verified-email` into the RPC, then redeploy that function.
- Return a distinct reason to the client so a future block reads "previously deleted — acknowledge required" instead of the generic "Could not send setup email".

**Part 3 — small UI fix**
The 404 attempt came from invoking with an id that has no auth user. Disable the Send setup link action for rows without a resolved auth user id, and show the server's reason in the toast rather than a fixed string.

## Verification

- `agent_activation_tokens` gets one `issued` row for `5c01fbf0-…`.
- `email_jobs` gets one `license-verified/<token id>` row on the `transactional` stream, reaching `sent`.
- A second click within the same minute dedupes rather than sending twice.
- An agent with a rejected verification or an already-activated account still gets refused.

## Scope guard

Transactional stream only. No change to `COMMS_EMAILS_PAUSED`, `HOT_SHEET_EMAILS_PAUSED`, or `EMAIL_SENDING_PAUSED`. No queue retries, backfills, bulk resends, or cron changes. Exactly one email is sent, to Christie, by your click.
