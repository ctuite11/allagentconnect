# Why the activation reminder to Austyn Tuite never sent

## Cause (confirmed)

Every queued email is assigned a "stream" (a delivery lane) based on its template name. The list of template-to-stream mappings lives in the database, and the new `agent-activation-reminder` template was never added to it.

When a template is unknown, the system deliberately fails closed: the email is stored with no stream, and the sending queue is built to skip any email without one. So the reminder sits in the queue forever — 0 attempts, no error, never picked up. That is exactly what the record shows.

The same thing has silently happened before: three older `team-approved` emails (Aug 31 and Sep 10) are stuck in the queue for the identical reason.

Nothing is wrong with the recipient address, the email content, the admin button, or the sending service — the License Verified email to the same address 12 minutes earlier went out fine.

## Fix

1. Add `agent-activation-reminder` to the template-to-stream list, mapped to the `transactional` lane (same lane as `license-verified`, `agent-login-link`, and `password-reset`). Done as a small, additive database migration — no other template mappings touched.
2. Repair the one stuck reminder record so it gets a stream and can be picked up on the next queue run. This is a single-row correction, not a re-send or re-queue of anything else, and I will ask for your explicit go-ahead before running it.
3. Leave the three old `team-approved` stuck emails exactly as they are. `team-approved` is also missing from the mapping; I will report it but not add it or release those emails unless you ask.

## Result

Once the mapping exists, the reminder (and any future activation reminders sent from Admin → Approvals) will process on the next minute's queue run and deliver normally.

## Technical details

- `public.email_stream_for_template(text)` returns NULL for `agent-activation-reminder`.
- The `email_jobs_enforce_stream` BEFORE trigger writes `stream = NULL` when the template is unknown; `email_jobs_claim(p_limit, p_streams)` requires `stream IS NOT NULL AND stream = email_stream_for_template(payload->>'template')`, so the row can never be claimed.
- Stuck row: `b33d9f8a-3d88-46d0-8179-842fd4eee7ab`, idempotency_key `agent-activation-reminder/12a5a3a1-...`, created 2026-09-21 18:17 UTC, status `queued`, attempts 0, `last_error` NULL, `stream` NULL.
- Migration: `CREATE OR REPLACE FUNCTION public.email_stream_for_template` with one added `WHEN 'agent-activation-reminder' THEN 'transactional'` branch, everything else byte-identical.
- Row repair (only after approval): `UPDATE public.email_jobs SET stream = 'transactional' WHERE id = 'b33d9f8a-...' AND status = 'queued' AND stream IS NULL;` — the cron `process-email-queue-every-minute` job then claims it.
- No frontend, template, RLS, or edge function changes required.
