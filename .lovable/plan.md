# Agent Forward Invitation — Email + PDF

Deliver a premium, forward-friendly "Agent Overview" HTML email and a matching one-page printable PDF, both styled to AAC standards (dark navy header, white body, emerald accents). The CTA URL is a placeholder for now; Cursor will inject the per-agent registration link later.

## What I'll build

### 1. New shared template builder
`supabase/functions/_shared/buildAgentForwardEmailHtml.ts`
- Pure function `buildAgentForwardEmailHtml({ ctaUrl })` returning the full HTML.
- Reuses AAC dark header treatment (monogram + "All Agent Connect" wordmark + emerald 2px divider) and dark footer styling from `aacEmailTemplate.ts` for visual consistency, but with a custom standalone body (no Founding Member / invitation language, no sender attribution).
- Sections:
  - **Hero**: headline "Everything you need to grow your real estate business—all in one platform." + subheadline.
  - **Grow Your Business** — 11 bullets with simple inline SVG/emoji-free check glyphs (emerald ✓ rendered as styled span for max client compatibility).
  - **Build Your Professional Network** — 4 bullets.
  - **Membership** — 3 bullets.
  - **CTA**: emerald button "Create Your Free Account" + small "Free for a limited time." line.
  - **Footer**: "By Agents. For Agents. All Agents." + AAC mark only.
- Mobile responsive via fluid `max-width:600px` table layout, `font-size` scaling, and stacked spacing. Bulletproof button (table-based) so it renders correctly in Outlook.
- All colors use existing AAC tokens: `#111317` (navy), `#50c878` (emerald accent), `#16A34A` (CTA green to match Buyer Portal CTA), `#ffffff`, `#0f172a` text, `#475569` body, `#64748b` muted.

### 2. New edge function
`supabase/functions/send-agent-forward-invite/index.ts`
- Accepts `{ to: string[], ctaUrl?: string, subject?: string }`.
- Defaults `ctaUrl` to `${PUBLIC_SITE_URL}/register` and subject to "All Agent Connect — A professional platform built for agents".
- Enqueues into `email_jobs` via the standard pattern used by `send-agent-invite`, then kicks `kick-email-queue`.
- Adds `Reply-To: hello@allagentconnect.com`.
- Returns `{ success, results, successCount }`.

### 3. Matching printable PDF
`public/email/agent-overview.pdf` (one page, US Letter)
- Generated via a small Node script `scripts/generate-agent-overview-pdf.cjs` using Playwright/Chromium print-to-PDF of a dedicated `public/email/agent-overview.html` page that mirrors the email layout but tuned for print (no email-client quirks, real CSS, proper font stack).
- Script is documented in README so it can be re-run if copy changes.
- Final PDF committed so users can download from `/email/agent-overview.pdf`.

### 4. Preview route (optional, dev-only)
`src/pages/dev/AgentForwardEmailPreview.tsx` mounted at `/dev/agent-forward-preview` — renders the HTML in an iframe for visual QA. No nav link; for internal review only.

## What I'm explicitly NOT doing

- No per-agent referral token logic, no DB schema changes — Cursor wires registration attribution later.
- No changes to existing `send-agent-invite` (that flow stays for the named "X invited you" use case).
- No marketing copy, no Founding Member references, no sender name, no "you've been invited" framing — strictly a platform overview.

## Verification

- Render the HTML in the dev preview route at three widths (375 / 600 / 900) and inspect via Playwright screenshots.
- Send a test job through `email_jobs` to my address and confirm Gmail + Yahoo + Apple Mail rendering (header, bullets alignment, CTA button, footer).
- Open the generated PDF and confirm: single page, no clipped text, emerald accents present, CTA visible, footer line intact.

## Open question before I build

The CTA needs a working URL placeholder so the button is clickable in early forwards. Confirm:
- Use `https://allagentconnect.com/register` as the default until Cursor swaps in the per-agent referral URL? (That's what `send-agent-invite` already uses.)
