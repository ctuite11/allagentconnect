## Goal

Give agents a login link that stays valid for **7 days** instead of the current 1 hour, without changing any global auth setting.

## Why this works

The existing activation flow already solves this exact problem. The AAC-issued token is what lives for 7 days; when the agent finally clicks it, the server mints a **fresh** short-lived auth link right at that moment and signs them in. The 1-hour auth expiry never has a chance to lapse, because the auth link only exists for the few seconds between click and sign-in.

```text
Email link (AAC token, 7 days)
      -> agent clicks, any time within 7 days
          -> server validates token, marks it redeeming
              -> mints a fresh auth link (valid seconds)
                  -> agent lands signed in, token marked redeemed
```

## What gets built

**1. Login-link tokens (database)**
A `agent_login_tokens` table mirroring `agent_activation_tokens`: single-use, 7-day expiry, SHA-256 digest only (never the plaintext), at most one live token per agent, atomic `issued -> redeeming -> redeemed` transition, service-role only with no anon/authenticated access.

**2. Redemption endpoint**
A `redeem-login-token` function that mirrors `redeem-activation-token`: validates the token, claims it atomically, generates a fresh magic link for that user, and returns it. Expired, already-used, or revoked tokens get a clear message plus a self-service "send me a new one" path.

**3. Sign-in page**
A `/signin-link` page that reads the token from the URL fragment (so it never hits server logs or the referrer header) and shows an explicit **Sign In** button — no auto-redemption on page load, so email scanners and link previewers can't burn the token.

**4. Admin action**
In Admin Approvals, a **Send login link** action on an agent that issues the 7-day token and enqueues the email on the `transactional` stream.

**5. Email**
Reuses the existing template system. Copy states the link is good for 7 days and works once. **No existing email template, wording, layout, branding asset, or footer is modified.**

## Explicit guardrails

- Global auth OTP/link expiry stays at 1 hour — untouched.
- Existing activation tokens, Hot Sheet streams, pause flags, and queue behavior are untouched.
- Plaintext tokens are never stored in the database or in `email_jobs`; the link is hydrated only at send time, exactly as activation does.
- Nothing is sent to a real agent until you preview it yourself and approve.

## Technical notes

- New migration `agent_login_tokens.sql` with `claim_`, `complete_`, and `release_` security-definer functions, modeled on the activation equivalents.
- `redeem-login-token` carries the `// @auth-classification: token-redemption` declaration so the security guard passes.
- Redemption uses `auth.admin.generateLink({ type: 'magiclink' })` and returns the hashed-token URL for the client to complete.
- Rate limiting: one live token per agent, and re-issuing revokes the prior one.
