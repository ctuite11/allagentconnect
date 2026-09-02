# Verification email link + 30-day setup token

## What's actually true today

- The License Verified email **does still contain a link** — a CTA button ("Activate My Account") plus a line reading "This activation link is valid until <date>". It is rendered at send time from the stored token, so the link only appears if the token still exists, is unused, and is unexpired. If the token expired before the queue sent the email, the send is skipped entirely — that's the case where an agent gets nothing usable.
- The token lifetime was **never raised to 30 days**. It is still 7 days in three places:
  - activation tokens (License Verified, admin-created invite, developer approval): 7 days
  - login-link tokens: 7 days
  - the database itself rejects any expiry more than **8 days** in the future

So the "we increased it to 30" change does not exist in the system.

## Proposed change: 30-day setup links

1. Raise the activation token lifetime from 7 to 30 days.
2. Raise the login-link token lifetime from 7 to 30 days (same email family — keep them consistent unless you want login links to stay short).
3. Update the database guard that currently caps expiry at 8 days so it allows up to 31 days. Both the activation and login-token issuing functions need this.
4. Email copy: the "valid until <date>" line is generated from the real expiry, so it updates automatically. Any hard-coded "7 days" wording in admin UI/toasts gets updated to 30.

Existing tokens already issued keep their original 7-day expiry; only newly issued links get 30 days.

## Questions before I build

- Should **login links** also go to 30 days, or keep those short (7 days) and only extend the account-setup/activation links?
- Longer-lived setup links are a mild security tradeoff (a forwarded email stays redeemable for a month). Tokens are still single-use and revoked on redemption, so this is generally acceptable — confirming you're fine with it.

## Technical detail

- `supabase/functions/_shared/activationTokens.ts` — `ACTIVATION_TOKEN_TTL_DAYS` 7 → 30
- `supabase/functions/_shared/loginTokens.ts` — `LOGIN_TOKEN_TTL_DAYS` 7 → 30 (pending answer above)
- Migration replacing `activation_issue_core` and `issue_agent_login_token` expiry range check `now() + interval '8 days'` → `interval '31 days'`
- Redeploy: `send-license-verified-email`, `resend-activation-link`, `send-login-link`, `send-admin-created-invite`, `admin-approve-developer-request`, and the email queue worker
- No emails sent as part of this work.
