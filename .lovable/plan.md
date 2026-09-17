# Brigid Murphy — "my link is expired"

## What I found (read-only)

Brigid Murphy (brigid@findyouraccess.com) is a real, approved member with a working account:

- Approved Jul 30
- Account created Jul 30, password already set
- She used a sign-in link on Aug 18 and successfully signed in that day

Her complaint is accurate: every link we ever sent her has since expired.

| Link sent | Expired |
| --- | --- |
| Setup link, Aug 6 | Aug 13 |
| Sign-in link, Aug 18 | Aug 25 (already used once on Aug 18) |

Both were issued under the old 7-day rule, before the 30-day link system. Links are also single-use, so the Aug 18 one was spent the moment she signed in. Nothing is wrong with her account — she simply has no live link, and her email is not on any blocked/deleted list.

One inconsistency worth noting: although she signed in on Aug 18, her record still shows no "account activated" date. That means Admin still lists her as approved-but-not-activated, and a new link would be issued as an activation/setup link rather than a sign-in link. She would land on the account-setup screen and be asked to set a password she already has.

## Proposed fix

1. Send Brigid a fresh 30-day link from Admin so she can get in today.
2. Decide how to handle the missing activation date:
   - Option A (recommended): investigate why signing in through a sign-in link does not record the activation date, then correct it for her and for anyone else in the same position. This is the underlying bug.
   - Option B: send the link as-is now; she completes the setup screen, which records activation, and we look at the bug separately.
3. Tell her simply: her old link expired, here is a new one, valid 30 days.

## Technical notes

- Account: auth user 84a61e00-c8f0-4d2d-b690-11c192ab49e9, `agent_settings.agent_status = 'verified'`, `account_activated_at = NULL`, `auth.users.last_sign_in_at = 2026-08-18`.
- Token rows: one activation token (issued Aug 6, expired Aug 13, never redeemed) and one login token (issued Aug 18, redeemed Aug 18).
- No `deleted_users` rows for this address, so issuance is not blocked.
- Because `generate-agent-setup-link` and `send-login-link` branch strictly on `account_activated_at`, she currently routes to `/activate#t=...`.
- Suspected root cause for Option A: `mark_agent_activated` runs on the account-setup screen; a login-token redemption that goes straight to the dashboard never stamps it. Needs confirmation before any change.

## Guardrails

- No emails sent, no tokens issued, no data changed until you approve.
- No RLS, schema, or template changes.
