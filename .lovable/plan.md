# Finish the activation work: live test, then email wording

Step 1 (rate limiting) is **already done and deployed**. Steps 2 and 3 are outstanding, and step 2 is blocked on one approval from you.

## What is already complete

The activation preview page had no throttle — the commit titled "Added activation rate limiting" contained only the breach-check and documentation changes. A limiter has now been added and deployed:

- **Per link:** 12 attempts per 10 minutes
- **Per visitor address:** 60 attempts per 10 minutes
- Response is a generic "too many attempts" — identical for a valid, expired, or non-existent link, so it reveals nothing about whether an account exists
- It only increments a counter; it never reads, claims, or consumes the activation link
- If the counter itself is unhealthy it lets the request through, so a real agent can never be locked out by our own outage
- No link or password value is written to any log

Verified live: attempts 1-12 answered normally, 13-15 returned the throttle response, and a plain page-fetch still returns "not allowed" (scanner-safe).

## Step 2 — Live end-to-end test (needs your approval to proceed)

**Blocker:** generating a setup link requires signing in as the admin account. The sandbox has a session for `doittuite15@yahoo.com`, which is not an admin, so the link request was refused. To continue I need to sign in as **chris@allagentconnect.com**, which triggers a one-time approval prompt for you.

Test account: **e2e.verified.agent@allagentconnect.test** — internal, verified, never activated, unreachable `.test` domain. No email will be sent.

Note: this account has no stored name or brokerage, so the form will prefill the email only. Name and brokerage will start blank.

Sequence:

1. Snapshot activation status, link state, profile, and sign-in state (already captured: verified, not activated, no links ever issued, no profile details)
2. Generate one setup link silently from Admin — no email sent, no email job created
3. Open it in a fresh private browser session and confirm: the link text disappears from the address bar immediately, the password form appears straight away, there is no extra confirmation screen, and the email prefills
4. Enter a strong password and press "Activate My Account" once
5. Confirm activation completes, sign-in succeeds, and the agent lands on the correct destination
6. Confirm the activation date is stamped and the link is marked used
7. Reopen the original link and confirm it can no longer activate
8. Confirm no email job was created and no other account changed
9. Separately confirm a tampered link returns the safe "not valid" state and exposes no account information

## Step 3 — Email wording (only if step 2 passes)

1. Read-only check of the email queue for any sendable activation emails (`license-verified`, `agent-activation-reminder`, `admin-created-invite`, or similar) that could be picked up when the email code is redeployed. Report them; change nothing.

   Current queue: 1 queued job total (Austyn's activation reminder, which has no delivery lane and therefore cannot be picked up). This will be re-confirmed immediately before deploying.

2. If the queue is safe, deploy the button wording change to **Set Your Password** for License Verified, Activation Reminder, and Admin Created Invite. Deploying template code sends nothing by itself.

## Final report

Rate-limit thresholds, test result, final link state, activation result, repeat-use result, queue audit, exact functions redeployed, and confirmation that no real member was emailed.

## Technical notes

- Limiter lives in `supabase/functions/_shared/activationRateLimit.ts`, enforced in `activation-preview` before any token lookup, keyed on `sha256(token)` (truncated) and the forwarded client IP. Backed by the existing `rate_limit_consume` RPC and `public.rate_limits` table — no new table or migration.
- The Netlify proxy now forwards `x-aac-client-ip` and passes the 429 through unchanged.
- `ActivateAccount.tsx` gained a `rate_limited` state with its own copy; it is deliberately excluded from the resend states.
- Admin session minting uses `lovable auth-session --user 1fc50da1-2664-4931-8cab-64e24dc5ed8c` (chris@allagentconnect.com).
- Step 3 redeploys `send-license-verified-email`, `send-admin-created-invite`, `process-email-queue`, and `send-single-email-job` (the last two import the shared hydrator).
- Nothing in this plan publishes the frontend.
