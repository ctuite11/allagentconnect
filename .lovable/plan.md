# Christie Xie — why verification never completes

## What the data shows

- Her request (`xie.christie@gmail.com`, MA license 9526583) was submitted Aug 3, 20:23 UTC and is already marked `status = verified`, processed Aug 3, 21:30 UTC.
- A new auth user + agent profile + `agent` role were created (`5c01fbf0-…`, AAC-0385), and `agent_settings.agent_status = verified`, `verified_at` stamped.
- But: `account_activated_at` is null, `approval_email_sent = false`, **no activation token row exists for her**, and **no license-verified / activation email job was created today**. Her last activation email was July 19, before her account was deleted.

So she is half-verified: flagged verified in the database, but she never received a setup link, so she can never set a password or activate. Her `last_sign_in_at` is null.

## Root cause

She was deleted on July 22 in a bulk admin deletion. That deletion is recorded in `deleted_users` (original user `d302d053-…`) and in `auth_user_deletion_queue`.

`admin-verify-agent` writes the verified stamp first, then calls `send-license-verified-email`. For a previously deleted email that call returns `409 previously_deleted` unless the admin passes `acknowledgeDeleted`. The function then returns a 422 to the admin UI without enqueuing anything — which matches exactly what is in the database: verified stamp present, activation token and email absent.

This is not a license or eligibility problem. It is the previously-deleted guard blocking the activation email.

## Fix for Christie (one action, no code change needed)

In Admin Approvals, open her record and use **Resend setup email**, confirming the "previously deleted" acknowledgement when prompted. That issues an activation token and enqueues the license-verified email on the transactional stream (unaffected by the Comms pause). If the prompt does not appear or the resend errors, I will invoke the resend path directly with the acknowledgement flag.

Verification after: an `agent_activation_tokens` row exists for `5c01fbf0-…`, and an `email_jobs` row with template `license-verified` to her address reaches `sent`.

## Recommended follow-up (separate approval)

Today's failure left her stranded in a state the admin list reads as "verified, not activated" with no way for her to proceed and no visible reason. Two small improvements, only if you want them:

1. Surface the `previously_deleted` reason in the Admin Approvals error toast instead of the generic enqueue-failure message.
2. Audit for other agents in the same state — `agent_status = 'verified'`, `account_activated_at` null, no activation token, and an entry in `deleted_users` — and report the list before any resend. No bulk resend without your explicit approval.

## Scope guard

No email queue retries, backfills, cron changes, pause-flag changes, or migrations. Comms and Hot Sheet streams stay untouched.
