## Founding Partner bulk email template

Create a new pre-built bulk email — an exclusive, hand-picked invitation from Chris Tuite to become a **Founding Partner** of All Agent Connect at no cost. Same visual shell as "First Look v2" (logo header, `#0E56F5` eyebrow, `#22C55E` accent rule, sectioned image rows, founder sign-off).

### 1. `supabase/functions/send-bulk-email/index.ts`

Add `buildFoundingPartnerBody()` modeled on `buildEarlyAccessUpdateV2Body()`:

- **Logo header** (reuse `AAC_LOGO_URL`).
- **Eyebrow:** `EXCLUSIVE INVITATION` (uppercase, blue).
- **Headline:** `You're invited to become a Founding Partner.`
- **Personal intro paragraph** (Chris's voice):
  > "Chris Tuite is sending you this exclusive opportunity because he recognizes you as a top producer in your market — and the kind of agent All Agent Connect was built for. This invitation is hand-picked, not a mass campaign. You're one of a small group of agents being offered Founding Partner status before we open the doors more broadly."
- **Hero image** (reuse `01-home.png` from `STORAGE_BASE_V2`).
- **What being a Founding Partner means** — 4 benefit rows (reuse existing v2 screenshots so no new assets needed):
  1. **Permanent Founding Partner status** — public recognition badge and priority placement in the verified agent network.
  2. **Lifetime free access** — Success Hub, Hot Sheets, Communications Center, and the referral network. No cost, no trial timer, no future bill.
  3. **Direct line to the founder** — shape the roadmap, request features, and get white-glove onboarding from Chris and the team.
  4. **First look at off-market inventory** — see coming-soon listings and active buyer demand before they reach the public market.
- **No-cost callout band** (subtle bordered block): `Zero cost. Zero risk. Founder pricing locked for life.`
- **Primary CTA button:** `Accept your invitation →` → `https://allagentconnect.com/agent-dashboard`
- **Secondary CTA link** (below button, smaller): `Or book a 15-minute intro call with Chris` → `mailto:chris@allagentconnect.com?subject=Founding%20Partner%20Invitation`
- **Sign-off block** — `Chris Tuite, Founder, All Agent Connect · 617-877-0519 · chris@allagentconnect.com` (same style as v2).
- **Footer disclaimer** — `You're receiving this because you were personally selected for the Founding Partner program.`

Wiring:
- Extend `isTemplated` check to include `"founding-partner-invitation"`.
- Extend `renderedBody` ternary so this template renders via `buildFoundingPartnerBody()`.

### 2. `src/components/admin/EmailAgentDialog.tsx`

- New `<SelectItem value="founding-partner-invitation">Founding Partner — Exclusive Invitation</SelectItem>` placed at the top of the template list.
- Extend `isTemplated` to include the new value.
- When selected, prefill subject (only if empty) with: `You're invited: Founding Partner of All Agent Connect`.
- Update the "Pre-built email…" helper line to also cover this template.

### 3. `src/components/BulkEmailDialog.tsx`

- Mirror the same `<SelectItem>`, `isTemplated`, and subject-prefill changes so the template is available from the non-admin bulk surface.

### Out of scope

- No new storage assets (reuses existing `early-access-v2` images).
- No DB / RLS / migration changes.
- No edits to the queue worker, rate limits, send envelope, or `_shared/aacEmailTemplate.ts`.
- No changes to other dialogs/templates.
