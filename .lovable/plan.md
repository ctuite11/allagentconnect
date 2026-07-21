## Problem

`send-comms-guide-broadcast` was built with an auth.getUser() + admin role check, which now fails with "Unauthorized - invalid session". The pattern doesn't match how our other single-recipient admin emails work (e.g. `send-personal-forward-invite`, `send-agent-forward-invite`), which simply accept `{ to: [...] }`, insert into `email_jobs`, and kick the queue — no session validation in the function.

## Fix — mirror the existing forward-invite pattern

**Rename/replace edge function:** `supabase/functions/send-comms-guide-broadcast/index.ts` → `supabase/functions/send-comms-guide-email/index.ts`

Simplify to match `send-personal-forward-invite`:
- Accept `{ to: string[], agentFirstName?: string, ctaUrl?: string }`
- No `auth.getUser()`, no role check, no `Authorization` header handling (function-level; access is gated by the admin-only UI surface, same as the existing forward-invite tool)
- Build HTML with `buildCommsCenterGuideEmailHtml`
- Insert one row per recipient into `email_jobs` with `template: "comms-center-guide"`, subject from `COMMS_CENTER_GUIDE_SUBJECT`, idempotency key `comms-guide-<email>-<yyyymmdd>`
- Invoke `kick-email-queue` at end, return `{ success: true, sent: n }`

**Frontend — `src/pages/AdminApprovals.tsx`:**
- Replace the current bearer-token invoke block with plain `supabase.functions.invoke('send-comms-guide-email', { body: { to: [adminEmail] } })` — same shape as the "Email me forwardable invite" button right above it
- Keep the single "Preview Comms guide email" button (sends to logged-in admin's email only). Bulk broadcast stays removed.
- Error toast: `error?.message ?? data?.error ?? 'Unknown error'`

**Cleanup:**
- Delete old `send-comms-guide-broadcast` folder
- Deploy new `send-comms-guide-email` function

## Verification

Click "Preview Comms guide email" → toast "Sent to <admin email>", email arrives with the 3-step Comms Center guide. If it fails, the toast surfaces the real error (same as forward-invite).

## Files touched

- `supabase/functions/send-comms-guide-email/index.ts` (new, replaces broadcast)
- `supabase/functions/send-comms-guide-broadcast/` (deleted)
- `src/pages/AdminApprovals.tsx` (simplified invoke)