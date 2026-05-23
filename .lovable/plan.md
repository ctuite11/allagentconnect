## Goal

Stop emailing recipients about direct messages they've already read in-app. Add a 10-minute grace window before any message-notification email is sent. If the recipient reads the message in-app at any point before that window expires, no email is sent. Applies to both agent and buyer sides — any `conversation_messages` row with a recipient.

## Behavior

- Send a message → **no email immediately**.
- Wait **10 minutes**.
- A scheduled job runs every minute and enqueues an email only for messages where:
  - `read_at IS NULL`
  - `created_at < now() - interval '10 minutes'`
  - `email_enqueued_at IS NULL`
  - `recipient_agent_id IS NOT NULL` and `<> sender_agent_id`
- If the recipient opens the thread within 10 minutes (sets `read_at`), the row is skipped permanently — no email, regardless of whether they replied.
- After enqueue, `email_enqueued_at` is stamped so it can never be enqueued twice.

This works identically for agent recipients and buyer recipients, since both sides use `conversation_messages.recipient_agent_id` (the column name is legacy; it stores the recipient user id either way) and both sides set `read_at` via the existing `useConversation` flow when the thread is opened.

## Changes

### Migration (single new file)

1. Add column `email_enqueued_at timestamptz` to `public.conversation_messages` and a partial index on `(created_at) WHERE read_at IS NULL AND email_enqueued_at IS NULL`.
2. Drop the existing `enqueue_message_email` AFTER INSERT trigger so inserts no longer enqueue immediately. Keep the function definition harmless or drop it.
3. Create `public.process_pending_message_emails(grace_minutes int default 10)`:
   - Selects unread, un-enqueued messages older than the grace window with a valid recipient.
   - Resolves recipient email + sender display name using the same agent_profiles → profiles fallback the current trigger uses.
   - Inserts the same `new-message-notification` payload into `email_jobs` (relative `cta_url = '/messages/' || conversation_id`).
   - Stamps `email_enqueued_at = now()` per row.
4. Schedule with `pg_cron` every minute, idempotently:
   - `select cron.unschedule('process-pending-message-emails')` if it exists, then `cron.schedule('process-pending-message-emails', '* * * * *', $$ select public.process_pending_message_emails(10); $$);`

### No frontend changes

`useConversation` already writes `read_at` when a recipient opens the thread on either side. That's the read signal. No UI work.

## Out of scope

- Hot sheet comment emails, listing inquiry emails, client→agent contact emails — separate pipelines, untouched.
- Per-user email preferences / mute toggle.
- Push or in-app toast changes.
- Email template copy.