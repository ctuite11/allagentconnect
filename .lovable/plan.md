# Barbara Mihalko sign-in + admin email history

## Barbara's password emails today (checked)
Four emails went to bmihalko08@gmail.com today; Gmail accepted all four:
- 12:22 PM ET – "Your sign-in details" (temporary password)
- 12:46 PM ET – "Reset your password" link
- 12:53 PM ET – "Reset your password" link
- 1:09 PM ET – "Your sign-in details" (newest temporary password)

There are no open reset links left to clear: both reset links are already dead, and only the newest password (1:09 PM) works. Her email is confirmed and her account isn't blocked. She hasn't signed in since Oct 8.

"Delivered" only means Gmail accepted it. Since she isn't seeing them, they're most likely in Spam, Promotions or All Mail.

Recommended (no more emails sent):
- Ask her to search Gmail for "All Agent Connect" in Spam/Promotions, or
- Send her the 1:09 PM password yourself by text or phone. If you don't have it anymore, set a new one in the admin dialog and use "Copy message" instead of "Email it to the agent".

No resends, no more emails, and no changes to her account unless you ask.

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
