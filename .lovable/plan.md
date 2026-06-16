# Canonical sender confirmation + consistency sweep

## Audit result

Grepped every email sender. The **From header is already `All Agent Connect <hello@notify.allagentconnect.com>` everywhere** that sends mail:

- `supabase/functions/_shared/transactionalSender.ts` (`DEFAULT_TRANSACTIONAL_FROM_EMAIL`)
- `supabase/functions/send-auth-email` (invites + hot-sheets via queue)
- `supabase/functions/send-password-reset`
- `supabase/functions/send-agent-approval-email`
- `supabase/functions/send-verification-submitted`
- `supabase/functions/send-license-upload-notification`
- `supabase/functions/submit-early-access` (both sends)
- `supabase/functions/convert-early-access-to-account`
- `supabase/functions/send-bulk-email`
- `netlify/functions/email-worker.ts` (`canonicalFrom`)
- `netlify/functions/send-pending-approval-email.ts`
- `netlify/functions/send-password-changed-email.ts`
- `netlify/edge-functions/request-password-reset.ts`

Shared template footer (`_shared/aacEmailTemplate.ts`) is already `notify`.

## Sweep targets (replace `hello@allagentconnect.com` → `hello@notify.allagentconnect.com`)

**Inline HTML footers / "Questions?" / remove-my-account mailtos** (functions that don't use the shared template):
- `supabase/functions/submit-early-access/index.ts` (lines 215, 218)
- `supabase/functions/convert-early-access-to-account/index.ts` (lines 145, 154, 157)
- `netlify/edge-functions/request-password-reset.ts` (lines 91, 93)
- `netlify/functions/send-pending-approval-email.ts` (lines 59, 61)
- `netlify/functions/email-worker.ts` (lines 336, 339)
- `supabase/functions/email-unsubscribe/index.ts` (lines 50, 81)

**Generic / fallback Reply-To values** (system-level AAC, not a specific agent):
- `supabase/functions/send-auth-email` line 213-ish
- `supabase/functions/send-password-reset`
- `supabase/functions/send-agent-approval-email`
- `supabase/functions/send-verification-submitted`
- `supabase/functions/send-license-upload-notification`
- `supabase/functions/submit-early-access` (both)
- `supabase/functions/convert-early-access-to-account`
- `supabase/functions/send-bulk-email` (the `|| "hello@allagentconnect.com"` fallback only — preserve `agentEmail` primary)
- `netlify/edge-functions/request-password-reset.ts`

**List-Unsubscribe mailto**:
- `supabase/functions/_shared/sendEmail.ts` line 105

**Stale comment**:
- `supabase/functions/send-auth-email/index.ts` lines 6–7

## Explicitly NOT touched (intentional agent Reply-To)

- `supabase/functions/send-listing-share/index.ts` line 115 — Reply-To routes back to the sharing agent's flow; keep as-is per "don't overwrite intentional agent Reply-To" rule.
- `supabase/functions/send-bulk-email` `senderReplyTo = agentEmail || …` — only the fallback string changes; `agentEmail` continues to take priority.
- Any per-message Reply-To set to an inviting/sending agent's address at call time.
- `supabase/functions/request-showing.ts` and `send-contact-email` `to:` inboxing addresses (not sender identity).

## Out of scope
DNS, Resend config, queue/cron, invite logic, template structure, idempotency, sender separation strategy.

## After file edits
Redeploy the affected Supabase Edge Functions:
`send-auth-email`, `send-password-reset`, `send-agent-approval-email`, `send-verification-submitted`, `send-license-upload-notification`, `send-bulk-email`, `submit-early-access`, `convert-early-access-to-account`, `email-unsubscribe`.

(Netlify functions redeploy on push automatically.)
