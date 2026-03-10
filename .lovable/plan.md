

## Rebuild Home (/home) to Match Figma Design

This is a full-page rebuild of `src/pages/Home.tsx` to match the uploaded Figma design. The design has ~10 distinct sections with a mix of dark and light backgrounds, hero photography, platform screenshots, and a full footer.

### Design Sections Identified from Figma

1. **Header** — Dark transparent nav with logo, nav links (For Agents, Marketplace, Features, Agents, Pricing), green "Get Access" CTA, Login link
2. **Hero** — Dark background, large agent photo left-aligned, headline "A private agent network for PRE-MLS intelligence.", green CTA
3. **Network Intelligence** — Light section, pill badge, headline "Operate on network intelligence, not the public feed", platform screenshot mockup
4. **Agent Photos Row** — 4 agent headshots with names, one highlighted in green
5. **Results Hub** — "Turning network intelligence into real results" with icon nodes around central AAC globe
6. **Agent Testimonials** — "How agents are using All Agent Connect" with 3 photo cards
7. **Dark Feature Cards** — Marketplace tools section with dark background
8. **Scale & Persistence** — "Deliberately designed for scale and persistence" with dark screenshot and feature bullets
9. **GCI Section** — Dark bg, "GCI driven by better information and faster connections", 6 value-prop icons, green CTA
10. **Final CTA** — "See the Market Before it Happens" with green button
11. **Footer** — Full multi-column footer with links

### Implementation Approach

**Phase 1 — Structure & text-only sections** (this pass)
- Rebuild `src/pages/Home.tsx` with all 11 sections
- Use placeholder divs for hero photo, platform screenshots, and agent photos (these need real assets)
- Match typography, spacing, dark/light section alternation, and green CTA color from Figma
- Keep existing navigation logic (Login → `/auth`, Get Access → `/auth?mode=register`)

**Phase 2 — Assets** (separate pass, needs your input)
- Hero agent photo
- Platform screenshot mockups
- Agent headshot photos
- Any other imagery from Figma

### Key Design Decisions

- **Green CTAs**: The Figma uses emerald/green for primary CTAs (not black or blue) — this is a departure from the current Home page. Will implement as shown in Figma.
- **Dark sections**: Multiple sections use dark backgrounds (hero, feature cards, GCI section) — matches the Figma's contrast pattern.
- **No globe animation**: The current NetworkGlobe component stays available but the Figma shows a static globe icon in the results hub section.
- **Footer**: Full footer with link columns replaces the current minimal footer.

### Files Modified

- `src/pages/Home.tsx` — full rewrite to match Figma layout

### What I Need From You

Before or after Phase 1, you'll need to provide:
1. The hero agent photo (or confirm using a placeholder)
2. Platform screenshot images for the mockup sections
3. Agent headshot photos (or confirm using placeholders)
4. Exact nav link destinations (For Agents, Marketplace, Features, Agents, Pricing)

