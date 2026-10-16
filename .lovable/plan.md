# Create Agent email audit (read-only findings + proposed next steps)

## What I found
- **The emails are being sent.** Every agent created from Create Agent got the "Chris Tuite invited you to All Agent Connect" email queued and handed off. No agent created by an admin was skipped.
- **Recipients' mail servers accepted them.** Of the last 51, 48 show "delivered", 1 bounced (andrea.hulme@corcoranadvisors.com, a temporary bounce), and 1 is delayed (n.lopachak@carbonet.ltd).
- **Sender setup is healthy.** SPF, DKIM and DMARC are all in place for allagentconnect.com.
- **But nobody from the Oct 14 batch has activated:** 0 of 44 (34 Compass, 21 Corcoran). Earlier batches activated at 5–8%. For one-off sends, nearly everyone activated.
- **This email has no open or click tracking**, so I can't tell whether it landed in the inbox, spam or quarantine.

## Most likely cause (not yet proven)
"Delivered" only means the company's mail server accepted the email. Compass and Corcoran run corporate filters that often **quarantine** messages after delivery. The Oct 14 batch sent 44 near-identical invites to two company domains within about 2 hours. That's the classic pattern those filters catch. The 1:1 sends, which weren't caught, activated.

## Proposed next steps (each needs your OK, nothing sent)
1. **Confirm the cause with no sends.** Ask 1–2 Compass or Corcoran recipients you know to check spam or quarantine for the Oct 14 email. That's your call. I won't contact anyone.
2. **Turn on open/click tracking for this one email**, so future sends show whether people open it. This is a backend change only. The email's wording and design stay the same, per the template freeze.
3. **Pace future Create Agent sends** to the same company domain, for example a few per hour instead of dozens at once. This only affects new sends; nothing old is re-sent.
4. **Resending the Oct 14 batch is NOT included.** That needs your explicit approval for each send, under the queue rule.

## Technical details
- Path: `admin-create-user` calls `send-admin-created-invite` (fire-and-forget), which enqueues `email_jobs` with template `admin-created-invite`. `process-email-queue` sends via Resend from `hello@allagentconnect.com` with reply-to chris@.
- Evidence: `email_jobs` + `email_events` (delivered/bounced/delayed), `agent_settings.account_activated_at`, and `email_job_opens`/`email_job_clicks` (no rows for this template).
