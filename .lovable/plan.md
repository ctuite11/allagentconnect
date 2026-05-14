# Early Access Update — Email Blast

A polished HTML email featuring screenshots of 5 key AAC surfaces, each captioned with a luxury-flavored sample scenario (fake names, fake addresses, fake price points). Wired as a new reusable template in `send-bulk-email`, selectable from `BulkEmailDialog`.

## Pages featured (in order)

1. **Homepage Hero** (`/`) — "Where elite agents connect, off‑market."
2. **Agent Dashboard / Success Hub** (`/agent-dashboard`) — pipeline, metrics, market activity at a glance.
3. **Communications Center** (`/messages` or comms route) — unified inbox for clients + agents.
4. **Results / Listing Search** (`/listings` or search results) — MLS‑style discovery surface.
5. **Agent Referral Network** (`/network` discovery) — protected directory of vetted agents.

Each section in the email gets:
- Full‑width screenshot (rounded corners, soft shadow, AAC frame)
- Bold headline + 1–2 sentence description of the feature
- Italic "scenario" line with luxury fake data, e.g.:
  - *"Charles Whitman just listed 248 Beacon Hill Penthouse — $6.4M — privately to 12 vetted agents."*
  - *"Sloane Whitfield's buyer is hunting Back Bay brownstones, $3M–$5M. 4 agents matched in 2 minutes."*
  - *"Henry Ashford referred a Greenwich client to Margaux Devine — closed at $8.9M."*

## Implementation steps

### 1. Capture screenshots
Use `browser--screenshot` at 1280×800 on the 5 routes above (logged‑in admin session). Save to `src/assets/email/early-access-v1/` as `01-home.jpg` … `05-network.jpg`.

### 2. Upload to public bucket
Use `supabase--storage_upload` to push each into the existing `email-attachments` (or `brand-assets`) public bucket under `email/early-access-v1/`. Capture the public URLs.

### 3. New email template
Add case `"early-access-update-v1"` to `supabase/functions/_shared/renderEmailTemplate.ts`. Renders via `buildAacEmail` with 5 stacked sections (image + headline + body + scenario), AAC brand colors, footer CTA "Open your Success Hub" → `/agent-dashboard`.

### 4. Wire into bulk send
- Update `supabase/functions/send-bulk-email/index.ts` to accept `template: "early-access-update-v1"` and call the renderer (skip the user‑typed message path when this template is chosen).
- Update `src/components/BulkEmailDialog.tsx` to add a "Template" select: *Custom message* (current default) | *Early Access Update — Product Tour*. When the template is chosen, hide the message textarea and show a small preview link instead.

### 5. Deploy + QA
- Deploy `send-bulk-email`.
- Send a test to a single admin address.
- Convert resulting HTML to image and visually verify all 5 screenshots load, captions render, links work.

## Sample copy (draft)

**Subject:** A look inside All Agent Connect — built for agents like you

**Preheader:** Five new ways AAC is changing how top agents work together.

**Sections:**

1. **The new front door for elite real estate.**
   AAC is the private network where vetted agents share off‑market opportunities, refer clients, and close faster.
   *Charles Whitman just listed 248 Beacon Hill Penthouse — $6.4M — privately to 12 vetted agents.*

2. **Your Success Hub — every deal in one view.**
   Pipeline, buyer activity, listing performance, and live market signals on one page.
   *Margaux Devine watched 3 of her Back Bay listings get 47 qualified views overnight.*

3. **Communications Center — clients and colleagues, one inbox.**
   Email, message, and collaborate without leaving AAC.
   *Sloane Whitfield closed a Greenwich referral entirely through her AAC inbox.*

4. **Results that move — MLS‑grade search, AAC speed.**
   Find the right home or comp in seconds with rich filters and radius search.
   *A Newport buyer searching $4M–$7M waterfronts surfaced 9 perfect matches in one click.*

5. **The Agent Referral Network — your trusted bench.**
   Discover and refer to top agents in any market, with protection from cold scraping.
   *Henry Ashford referred a Greenwich client to Margaux Devine — closed at $8.9M.*

**CTA:** *Open your Success Hub* → `https://allagentconnect.com/agent-dashboard`

## Files touched

- new: `src/assets/email/early-access-v1/01-home.jpg` … `05-network.jpg` (or storage‑only)
- edit: `supabase/functions/_shared/renderEmailTemplate.ts` (+ new case)
- edit: `supabase/functions/send-bulk-email/index.ts` (template branch)
- edit: `src/components/BulkEmailDialog.tsx` (template selector)
- deploy: `send-bulk-email`

## Open questions (will assume defaults if you don't answer)

- **Subject + preheader** — use the draft above? (default: yes)
- **Recipient list** — only the early‑access registered agents (existing bulk flow target)? (default: yes)
- **Logged‑in screenshots** — OK to capture from your admin session so dashboards aren't empty? (default: yes)
