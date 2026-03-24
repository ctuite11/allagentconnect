

# Fix Agent Profile: Remove Top Toolbar + Redesign Layout

## Problem
1. The top navigation bar renders on `/agent/:id` because it's explicitly excluded from `SIDEBAR_MANAGED_PREFIXES` (line 41 comment says "NOT /agent/:id (public profile)" — but this is wrong, it's a private authenticated page)
2. The page layout still doesn't match the reference design quality — it needs a proper editorial redesign, not incremental patches
3. No green "accepting new buyers" pill needed — this is an internal workspace page

## Changes

### 1. Navigation.tsx — Hide top bar on agent profile routes
Add `"/agent/"` as a prefix to `SIDEBAR_MANAGED_PREFIXES`. Since all the specific `/agent/listings`, `/agent/profile`, etc. entries already exist and match first, adding the broader prefix just catches the dynamic `/agent/:id` routes. Remove the misleading "public profile" comment.

### 2. AgentProfile.tsx — Full render redesign
Replace the entire render output (lines 203-458) with a centered, section-based editorial layout inspired by the reference screenshots:

**Hero section** (centered, generous spacing):
- Large circular headshot (w-36 h-36 rounded-full) with ring border, or AAC monogram fallback
- Name as `text-4xl font-bold`, with last name in `text-primary`
- Title and company below in muted text
- AAC ID as small mono text
- Horizontal contact info row: phone, email, website — separated by subtle dividers, centered
- Compact action buttons centered: "Contact Agent" (primary) + "Save Contact" (outline)
- Small badges row beneath (DirectConnect, Verified)

**About section**:
- Two-column layout: left has uppercase "ABOUT" label + a headline like "Get to Know {firstName}", right has the bio text at readable width
- Social icons centered below in small bordered circles

**Testimonials section**:
- Centered uppercase label + heading
- 3-column grid of white cards with neutral borders, quote icon, star rating, testimonial text, client name
- No left-border accents, no tinted fills

**Listings section**:
- Centered uppercase label + heading
- 3-column grid with generous image height (h-40+), price badge overlay, property details below

**Back navigation**: Simple "Back to Network" link at top-left, no toolbar treatment.

### Not changed
- Data fetching logic (lines 126-181)
- `generateVCard` utility
- `ContactAgentProfileDialog` usage
- Routing, sidebar, auth

### Files modified
1. `src/components/Navigation.tsx` — add `/agent/` prefix
2. `src/pages/AgentProfile.tsx` — full render redesign

