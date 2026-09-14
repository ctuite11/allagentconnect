# What was sent to Barbara — and preventing the misclick

## What actually happened

At 6:59pm ET today, the admin menu action **Reset Password** ran for barbara.mihalko@gibsonsir.com. It sends immediately — no dialog, no confirmation.

In the agent row menu, the two items sit next to each other:

```text
Set Password      <- opens the dialog you expected
Reset Password    <- sends instantly, no dialog
```

## The exact email she received

- From: All Agent Connect (hello@allagentconnect.com)
- Subject: "Reset your password"
- Body: "We received a request to reset your password. Click below to choose a new one." plus a **Reset Password** button, and a note that the link expires in 1 hour and can be ignored if she didn't request it.
- No password, no account details, nothing sensitive. Delivered successfully.
- The 1-hour link has already expired, so it now does nothing.

It also does not appear in her email history in Admin, because this one email path sends directly instead of going through the normal email queue — which is why it looked invisible.

## Proposed fixes

1. **Confirmation step** — "Reset Password" asks "Send a password-reset email to <email>?" before sending, so a stray click can't send anything.
2. **Clearer labels** — rename to "Set password (no email)" and "Email password reset", and separate them with a divider so they're not adjacent look-alikes.
3. **Visible record** — record this reset email so it shows in the agent's email history and the Last Email column like every other personal send.

Note: this reset email uses the old ~1-hour link, not AAC's 30-day system. I'd leave that as-is for now and raise it separately if you want it converted.

## Next step for Barbara

Nothing is broken on her account. Use **Set Password** to set one and send her the details, or **Email 30-day sign-in link**.

## Technical notes

- Trigger: `handleSendPasswordReset` in `src/pages/AdminApprovals.tsx` → `send-password-reset` edge function (confirmed in its logs at 22:59 UTC, Resend message id `09b7f360…`).
- Fix 1 and 2 are frontend-only changes in `AdminApprovals.tsx` (plus the details drawer's `onResetPassword`).
- Fix 3 adds an `email_jobs` audit row from the `send-password-reset` function (or a queued send) with template `password-reset`, plus its template-label and Last Email allowlist entry. No schema change.
- No changes to the temp-password dialog, token system, or any other email template.
