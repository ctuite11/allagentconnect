# Simplify the agent activation flow (audit + proposed minimum change)

## What happens today

1. Email CTA "Activate My Account" → `https://allagentconnect.com/activate#t=<token>`
2. `/activate` reads the token from the URL fragment, scrubs it from the address bar, holds it in memory, and shows a second "Activate My Account" button.
3. That button does a real form POST to `/api/activate-redeem` (token in the body) → the redeem function claims the token, verifies the signature, generates a one-hour recovery link and redirects the browser to it.
4. The recovery link signs the agent in and lands on the setup page, which shows email / first name / last name / brokerage / password / confirm and a third "Activate My Account" button.

So the agent clicks three buttons, and the password form is only reachable after the token has already been consumed.

The security property to preserve: the token lives only in the fragment (never sent to a server on navigation), is never redeemed on page load, and is only consumed by an explicit POST.

## Why the extra click exists, and how to remove it safely

The middle screen exists only because the token has to travel from the fragment into a POST body, and today that POST is what mints the session the setup page needs.

The token can stay just as protected while the human sees the password form first: `/activate` keeps reading the fragment and scrubbing it, but instead of rendering a confirmation screen it renders the setup form immediately with the token held in memory. Nothing is redeemed on load. Email scanners and prefetchers still cannot activate anything, because activation still requires the explicit final submit.

Prefilling the form (verified email, name, brokerage) needs one read-only lookup. That lookup is a POST from the page's JavaScript — non-JS scanners never make it, it changes no state, it never marks the token used, and everything it returns is already known to whoever holds the token. If it fails or the token is bad, the page falls back to the existing expired/invalid/used screens.

## Proposed flow

```text
Email "Set Your Password"
  -> /activate#t=<token>          (fragment scrubbed, token in memory, nothing redeemed)
  -> read-only preview            (email, first/last name, brokerage; no state change)
  -> agent fills password
  -> "Activate My Account"        (single explicit POST: token + profile + password)
  -> activated, signed in, routed to Success Hub / returnTo
```

## Changes required

### Backend
- New edge function `activation-preview` (POST only): accepts a token, verifies the HMAC against the stored record, and returns only `{status, email, firstName, lastName, company}` — or `expired | used | revoked | ineligible | invalid`, plus a resend handle on the same states as today. It never claims, never completes, never mints a session. Rate-limited per token id.
- New edge function `activation-complete` (POST only): the single explicit submission. Claims the token atomically (existing `claim_agent_activation_token`), verifies the signature, saves first/last name + brokerage, sets the password via the admin API, calls `mark_agent_activated`, then completes the token (`complete_agent_activation_token`). Any failure releases the claim so the agent can retry.
- Two matching same-origin Netlify proxies (`/api/activation-preview`, `/api/activation-complete`) so the browser never calls the backend cross-origin and the resend cookie keeps working exactly as it does now.
- `redeem-activation-token` and `/api/activate-redeem` stay in place untouched, so links already sitting in inboxes keep working.

### Frontend
- `src/pages/ActivateAccount.tsx` becomes the setup screen: same fragment handling and scrubbing, same `returnTo` stashing, same expired/used/invalid/ineligible/resend states, but the ready state renders the setup form (reusing the existing `AgentAccountSetup` layout and password rules) with a final "Activate My Account" button.
- On success the page signs the agent in with the password just chosen and routes to the stashed destination or role home — the same routing `AgentAccountSetup` does today.
- `src/pages/AgentAccountSetup.tsx` stays as-is for recovery/admin temp-password paths.

### Email
- Activation CTA label changes from "Activate My Account" to "Set Your Password" in the reminder and admin-invite builders. The License Verified template is under a standing freeze, so I will not touch it without your explicit go-ahead on that one template. No emails sent, no queued rows touched.

## Can activation and password setup be one submission?

Yes. Setting the password server-side with the admin API removes the need for a recovery session altogether, so the token claim, profile save, password set and activation stamp all happen inside one request. Sign-in afterwards uses the password the agent just chose.

## Expired / used / resend

Unchanged in behavior. The preview call returns the same states the redeem call returns today, and the page shows the same copy and the same "Email me a new activation link" button backed by the same HttpOnly single-use resend handle.

## Risks
- The preview endpoint discloses name/email/brokerage to a valid-token holder. That is already true today (redeeming produces a signed-in session), but it moves the disclosure earlier — mitigated by POST-only, no state change, and rate limiting.
- Two activation paths coexist during rollout (old links → old screen, new links → new screen). Intentional, so nothing in flight breaks.
- Setting the password with the admin API bypasses the recovery-link path; the leaked-password (HIBP) and policy checks must be applied explicitly in the new function.
- A partial failure mid-submission must release the token claim, or the agent hits "already being used".

Nothing has been implemented, deployed, or sent.
