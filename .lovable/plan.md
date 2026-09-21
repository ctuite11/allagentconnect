# Dedicated nudge email for verified-but-not-activated agents

## Goal
Give admins a short, personal "finish activating your account" reminder email, sent from the existing reminder buttons in Admin Approvals, without touching the frozen License Verified template.

## What changes

### New email template (backend)
- **New shared builder** `supabase/functions/_shared/buildActivationReminderEmailHtml.ts`
  - Short personal nudge: greeting by first name, one or two sentences ("You're verified — one step left"), a single **Activate My Account** button, expiry note ("This link is valid until {date}"), Chris Tuite founder signature block (same as the other activation emails).
  - Template name: `agent-activation-reminder`. Subject: a short activation-focused line.
- **Late rendering** — `supabase/functions/_shared/hydrateActivationEmail.ts`
  - Add `agent-activation-reminder` to `isActivationTemplate()` and render the new builder for it. The plaintext token is still never stored; the CTA is re-derived at send time exactly like today.

### Secure token path (database, narrow migration)
- Today the activation RPC hardcodes template `license-verified`. Add an optional `p_template` parameter (default `license-verified`, allowlist: `license-verified`, `agent-activation-reminder`) to:
  - `public.build_activation_email_payload(...)`
  - `public.activation_issue_core(...)`
  - `public.reissue_agent_activation_token(...)`
- `issue_agent_activation_token` (the initial approval send) is **not** changed — approvals keep sending the frozen License Verified email.
- All existing gates unchanged: eligibility (verified, not activated), live-token replace-on-resend, previously-deleted gate, single-use 30-day hash-only tokens, minute-bucketed idempotency.

### Edge function
- `supabase/functions/send-license-verified-email/index.ts`
  - Accept a new optional field `variant: "reminder"` (only honored with `mode: "resend"`). When present, pass template `agent-activation-reminder` to the reissue RPC.
  - Caller still cannot supply recipient, CTA URL, subject, or HTML. Unknown variants rejected.

### Admin UI
- `src/pages/AdminApprovals.tsx`
  - The per-agent "Resend Invite"/activation-reminder button and the bulk "Send activation reminders" button pass `variant: "reminder"` so verified-not-activated agents get the new nudge email. Behavior, confirmations, and rate-limit prompts unchanged.

### Admin reporting
- `supabase/functions/admin-list-agents/index.ts`
  - Include `agent-activation-reminder` in the templates counted for the existing **Last Reminder** field (and the Last Activation Reminder column if its definition covers activation nudges — match the existing spec).

## Deployment
- Apply the one DB migration (function parameter additions only — no table/RLS changes).
- Deploy `send-license-verified-email` and `admin-list-agents`.
- Send one controlled test copy to `chris@allagentconnect.com` via test path before any real use.
- Frontend publish only after review.

## Out of scope
- No changes to the frozen License Verified template or the initial approval email.
- No scheduled/automatic nudges.
- No changes to `agent-missing-opportunities` (that's for activated agents with incomplete profiles).
- No new emails to any agent without an explicit admin action.
