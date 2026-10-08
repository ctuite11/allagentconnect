# Resend webhook: why it was disabled, and does the signing secret still match (read-only)

Nothing gets turned on, rotated or changed. This is evidence only.

## What I will check

1. **Last event received.** Find the newest Resend webhook record the app saved (`email_events` where source = `resend_webhook`). This tells us roughly when events stopped arriving.
2. **Errors around that time.** Read the `resend-webhook` function logs for:
   - "Signature verification failed" (401). This would mean the secret doesn't match.
   - "RESEND_WEBHOOK_SECRET not configured"
   - 500 / config errors, timeouts
   
   Resend disables a webhook automatically after repeated failed deliveries. So a run of 401s or 5xx responses before the last event would explain why it was disabled.
3. **Is the secret saved?** Confirm by name only that `RESEND_WEBHOOK_SECRET` exists in the backend. The value is never shown.
4. **Endpoint URL.** Confirm the webhook URL in Resend points to the current backend's `resend-webhook` function. If it points to the old project (`kinifeyelxwiwkrzoerf`) or a removed URL, every delivery would fail. You'll need to read the URL from the Resend screen, because I can't see your Resend dashboard.
5. **Whether the stored secret matches.** I can't read the stored secret's value or Resend's. The only reliable way to confirm a match is one of these:
   - In Resend, compare the webhook's signing secret with what was saved. Because neither of us can see the stored value, the practical route is to copy the Resend secret into the secure update form, which replaces the stored value.
   - After re-enabling, Resend's "send test event" should return 200, not 401.

   Option (a) needs your approval later. I won't do it now.

## Report back
- When the last event was received
- The failure pattern before it was disabled: 401 = secret mismatch, 404/5xx = URL or function problem, none = disabled by hand
- Whether the secret name exists
- Recommended next step, waiting for your approval

## Out of scope
Re-enabling the webhook, rotating or updating the secret, code or function changes, sending any email, and touching the email queue.
