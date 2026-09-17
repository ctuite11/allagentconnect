# Send Brigid Murphy a fresh sign-in link

## What happens
Send Brigid (brigid@bentleyrealestategroup.com or her address on file — resolved server-side from her account) a fresh 30-day sign-in link using the existing `send-login-link` flow — the same one already used for member sign-in links.

- From: `hello@mail.allagentconnect.com` (the standard AAC sender)
- Design: the unified AAC email template
- Link: 30-day, single-use, `/signin-link#t=...`; only the token hash is stored
- Issuing this link revokes any prior live token for her account

## Steps
1. Invoke `send-login-link` for Brigid's account only.
2. Verify: exactly one email queued/sent to her, recorded as a login-link send.
3. Confirm no other emails, tokens, accounts, listings, or data changed.
4. Report the result and stop.

## Technical details
- `send-login-link` resolves the recipient server-side from her user record — no client-supplied email.
- Token generated via the existing login-token helper (hash persisted, plaintext only in the email URL).
- No code changes, no migrations, no deploys, no publish.

## Explicitly out of scope
- No other members contacted
- No password reset or temporary password
- No concierge, template, or backend changes
