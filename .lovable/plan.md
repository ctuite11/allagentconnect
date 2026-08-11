# Add "Email it to the agent" to Set Temporary Password

## Why it doesn't work today
The Set Temporary Password dialog was intentionally built as copy-and-paste only. It sets the password, confirms the account, and marks the agent activated — but it never queues an email. There is no send path, so nothing is broken; the feature simply doesn't exist yet.

## What gets added
1. Password is set exactly as it is today (unchanged).
2. After success, the dialog shows the copy/paste message plus a new **Email it to the agent** button.
3. Clicking it queues a branded All Agent Connect email to the agent with the same wording as the copy/paste message: sign-in link, their email, the password, and a note that it does not expire and can be changed in Settings.
4. The button shows a sent state and toasts on success or failure. Copy/paste stays available.

## Technical notes
- New email template `agent-temp-password`:
  - Builder `supabase/functions/_shared/buildTempPasswordEmailHtml.ts`, styled on the existing AAC login-link template (navy header, emerald accent, white body, monogram).
  - New `case "agent-temp-password"` in `_shared/renderEmailTemplate.ts`. No existing template is modified.
- Migration adding `WHEN 'agent-temp-password' THEN 'transactional'` to `public.email_stream_for_template` — unclassified templates fail closed and would never send.
- New Edge Function `send-temp-password-email`:
  - Requires a caller JWT with the `admin` role (same gate as `admin-set-user-password`).
  - Accepts `{ email, password }`, resolves the agent's first name, enqueues one `email_jobs` row with `reply_to: hello@allagentconnect.com` and an idempotency key of `temp-password:<email>:<password-hash>` so double-clicks don't duplicate but a fresh password can be re-sent.
  - Never logs the password.
- Frontend: `SetTempPasswordDialog.tsx` gains the send button calling the function via `invokeEdgeFunction`. No other dialog behavior changes.
- Deploy the new Edge Function after creation.

## Out of scope
No changes to existing templates, crons, queue processing, or any other email stream.