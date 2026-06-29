# Forwardable "Why pay for a network?" Email

A new variant of the Agent Forward email that Chris can send to himself from Admin, then forward from his personal inbox. The CTA in the forwarded email lands recipients on `/register` (Request Access).

## What gets built

**1. New email template — `supabase/functions/_shared/buildPersonalForwardEmailHtml.ts`**

Clone of `buildAgentForwardEmailHtml.ts` with two changes:
- H1 replaced with: **"Why pay for a network when you can launch one for free?"**
- Subhead replaced with: *"A professional platform built exclusively for licensed real estate agents."* (kept as-is)
- Body reuses the three existing sections unchanged: **Grow Your Business**, **Build Your Professional Network**, **Membership** (same bullets as Agent Forward).
- CTA button label: **"Create Your Free Account"** → `https://allagentconnect.com/register`.
- Footer renders Chris's personal agent card (headshot, name, title, company, phone, email, website) pulled from `agent_profiles` — same `renderAgentFooter` already used in Agent Forward.

**2. New edge function — `supabase/functions/send-personal-forward-invite/index.ts`**

Thin wrapper modeled on `send-agent-forward-invite`:
- Input: `{ to: string[], agentId?: string }` (defaults `to` to `chris@allagentconnect.com`, `agentId` to Chris's `agent_profiles.id`).
- Loads agent profile, renders HTML via `buildPersonalForwardEmailHtml`.
- Enqueues into `email_jobs` with subject **"Why pay for a network when you can launch one for free?"**, `reply_to` = Chris's email, then kicks the email queue.
- Returns `{ success, results }`.

**3. Admin button — `src/pages/AdminApprovals.tsx`**

Add a small secondary action in the existing admin toolbar area: **"Email me forwardable invite"**. On click:
- Calls `supabase.functions.invoke('send-personal-forward-invite', { body: { to: ['chris@allagentconnect.com'] } })`.
- Shows toast on success/failure.
- No confirmation dialog; idempotency key includes a timestamp so repeated clicks resend.

## What is NOT changed

- `send-agent-forward-invite` and `buildAgentForwardEmailHtml` are untouched (Agent Forward flow stays as-is).
- No changes to homepage CTAs, register flow, or email queue infrastructure.
- No new tables, migrations, or RLS changes.

## Technical notes

- Template follows the locked Unified Email Template standard (white body, navy header/footer, emerald accents) already used by Agent Forward — no new styling.
- CTA URL resolved through existing `resolveAacCtaUrl('/register')` so it always renders as `https://allagentconnect.com/register` regardless of preview/prod.
- Email enqueued via `email_jobs` so it benefits from the existing Resend worker, suppression list, and `hello@mail.allagentconnect.com` sender.
- Edge function registered in `supabase/config.toml`, deployed via `deploy_edge_functions` after file writes.

## Acceptance check

After deploy: click "Email me forwardable invite" in Admin → Chris receives the email at `chris@allagentconnect.com` within ~30s → forwarding it from Gmail preserves the green "Create Your Free Account" button, which opens `https://allagentconnect.com/register`.
