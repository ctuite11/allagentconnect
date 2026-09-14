# Password reset: automatic sending, visible afterwards

## What was sent to Barbara (answer)

At 6:59pm ET today the admin menu action **Reset Password** ran for barbara.mihalko@gibsonsir.com. It sends instantly — no dialog, no confirmation — and it sits directly under **Set Password** in the same menu.

The email she got: from All Agent Connect (hello@allagentconnect.com), subject "Reset your password", body "We received a request to reset your password. Click below to choose a new one." with a **Reset Password** button and a note that the link expires in 1 hour and can be ignored if she didn't request it. No password, no account details. Delivered. The 1-hour link has since expired.

It never showed in Email History because this email path sends directly through the provider instead of being recorded like every other AAC email.

## Audit of the two paths

Both already send immediately, with no approval step anywhere:

- **Member self-service** — Forgot password on the agent login page, plus the buyer, consumer and DCMLS login pages. All four call the same reset function and it sends right away.
- **Admin** — the Reset Password menu item and the agent details drawer call that same function directly, with no confirmation.

So nothing is queued or waiting. The only real problems are the misclick risk and the invisibility.

## Changes

1. **Member self-service: unchanged.** Still immediate, no admin involvement.
2. **Admin action renamed** to **Email password reset**, with a confirmation first: "Send a password-reset email to <agent email>?" — send immediately on confirm. Same confirmation in the agent details drawer.
3. **Separate the look-alikes.** The other action becomes **Set password (no email)**, with a divider between them so they are no longer adjacent twins.
4. **Record every reset email** — from both the member and admin paths — in the normal AAC email audit right after the provider accepts it, using template key `password-reset` and label `Password Reset`. Recording happens after sending and never blocks or delays delivery; if recording fails, the email still went out.
5. **Show it** in the agent's Email History and make it eligible for the **Last Email** column.
6. **Link lifetime stays at 1 hour.** No conversion to the 30-day activation/setup tokens.

## Guardrails

No change to activation links, 30-day setup links, temporary-password behavior, or any other email. No approval workflow anywhere. No new sending behavior — only a confirmation on the admin click and an after-the-fact record.

## Technical notes

- `supabase/functions/send-password-reset/index.ts`: after the Resend call succeeds, insert an `email_jobs` audit row with `status='sent'`, `delivery_status` from the response, `provider_message_id`, payload `{template:'password-reset', to, subject}` and an idempotency key of `password-reset:<email>:<timestamp-bucket>`. Insert is wrapped in try/catch and logged only on failure — the 200 response does not depend on it. `status='sent'` means the queue worker never claims it, so no double-send.
- Function-body-only migration: add `'password-reset' → 'transactional'` to `email_stream_for_template` (otherwise the enforce-stream trigger nulls the stream) and add `'password-reset'` to the `_latest_templates` default of `admin_agent_email_summary`. No table, column, RLS or grant changes.
- `src/lib/emailTemplateLabels.ts`: add `"password-reset": "Password Reset"`.
- `src/pages/AdminApprovals.tsx`: rename the two menu items, add a `DropdownMenuSeparator`, add the confirm in `handleSendPasswordReset` (covers the drawer's `onResetPassword` too).
- Unchanged callers: `Auth.tsx`, `BuyerAuth.tsx`, `ConsumerAuth.tsx`, `DcmlsAuth.tsx`, `AuthDiagnostics.tsx`.
- Verify: type-check and build; one reset to a test address appears in Email History as Password Reset with delivery status; email_jobs gains exactly one row per send; no other template affected. Stop for review before publishing.
