# Show temporary-password emails in the agent's admin email history

## Why it's missing
The email to Barbara was sent and delivered. The admin "Email history" panel on an agent only lists one email type — the "License Verified" email. Every other email (including "Your All Agent Connect sign-in details") is filtered out, so it never appears there.

## Change
- Add the temporary-password email ("Your All Agent Connect sign-in details") to the email types shown in an agent's admin email history.
- It shows the same details as existing rows: date, status (Delivered/Bounced/etc.), subject, from, reply-to, opens/clicks.
- The generated password is never shown in the history.

## Not changing
- No email is sent, resent or edited; the email template stays frozen.
- No other email types added unless you ask.
- Barbara's account and password are untouched.

## Verification
- Open Barbara Mihalko in Admin and confirm today's 12:22 PM ET "sign-in details" email appears as Delivered, with no password visible.

## Technical details
- `supabase/functions/admin-list-agent-emails/index.ts`: default `templates` becomes `['license-verified', 'agent-temp-password']`; confirm the response mapping excludes `payload.variables` (holds the password) and redeploy the function.
