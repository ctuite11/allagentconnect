# Private Network Lockdown + Homepage SEO — Review Findings and Plan

Read-only review. Nothing has been changed or deployed.

## Goal
Google finds All Agent Connect. Signed-out visitors and search engines see only: homepage, Request Access, Login/sign-up, and public info/legal pages. Everything inside the network requires sign-in, enforced by the backend.

## What a signed-out stranger can reach today (tested live, no login)

Pages that open with real member data:
- **Agent profiles** `/agent/AAC-xxxx` — any agent, including 181 invited-but-unverified agents and hidden agents (your own hidden profile opened).
- **Listings** `/property/...` and `/consumer-property/...` — a Coming Soon listing showed full address, price, photos and description.
- **Our Agents / Browse** directory pages, team pages, `/seller-listing/:id`.

Backend data handed to anyone with the public app key (no login):
- 68 listings: 28 Active, 22 Coming Soon, **17 Off Market**, 1 Pending (address, price, photos, open houses).
- 2 DCMLS listings.
- **1,502 agent buyer-coverage areas** (where agents have buyers).
- 137 listing view/stat rows; 4 teams + team members; 36 testimonials; 4 email templates.
- Agent lookups: any agent's profile by code, newest verified agents (names, companies, photos), the full list of verified agent IDs, the listing agent for any listing.
- "Is this email registered?" check (lets anyone test whether a person is a member).
- Photos, headshots, logos, floor plans and email attachments sit in openly readable storage (anyone with the link can view).

Sitemap: lists 528 agent profiles and 50 listings — advertising the private pages above to Google.

Google index: no Search Console is connected, so we cannot yet see what Google has indexed. A public search check returned nothing conclusive.

## Public sharing features this would affect (need your decision)
1. **Buyer Hot Sheet links** sent to buyers who are not members (`/client-hot-sheet/...`, `/client/hotsheet/...`) — token-protected today.
2. **Listing share emails** (single, bulk, favorites) that send buyers to the listing page.
3. **Facebook/social listing posts** and their preview images — they link to the public listing page.
4. **Agent invites, delegate invites, team invites, password/activation links** — token links; these must keep working.
5. Homepage pieces that may show agent count, newest agents or testimonials.

Recommendation: keep token-based links (1, 4) working, because a token is an authorization, but show only that one shared item — never the directory or other listings. Social posts and share emails (2, 3) would land on a sign-in page unless you choose otherwise.

## Plan (each phase needs your approval before going live)

**Phase 1 — Backend lockdown (highest priority)**
- Remove signed-out access to: the public listings and DCMLS listing views, buyer-coverage areas, listing stats, teams/members, email templates, and the agent lookup functions (profile by code, newest agents, verified IDs, listing agent).
- Keep for signed-out visitors only what the homepage and sign-up need (e.g. a member count number, approved testimonials if shown on the homepage).
- Replace the "is this email registered" check with a version that doesn't reveal membership, or limit it to signed-in admin/sign-up flows.
- Token links: a function returns only the single item the token grants.
- Storage: move listing photos, headshots and floor plans to signed (expiring) links — larger change; propose as Phase 1b since it touches every image on the site.

**Phase 2 — Pages**
- Agent profiles, listings, directory, browse, team and seller-listing pages require sign-in; signed-out visitors see a sign-in / Request Access prompt (no data loaded).
- Private pages send a "do not index" signal; the server returns it for `/agent/*`, `/property/*`, `/consumer-property/*`, `/our-agents`, `/browse`, `/team/*`.
- No change to what signed-in members see.

**Phase 3 — Sitemap**
- Marketing pages only: homepage, Request Access, Register, About (if public), Agent Network Rules, Privacy, Terms, Cookies, Disclosures, Fair Housing. No agents, no listings.
- Served as proper XML from the site itself (no backend lookup).

**Phase 4 — Homepage SEO**
- Title: "All Agent Connect | Private Network for Real Estate Agents"; your proposed description; canonical `https://allagentconnect.com/`; Organization + WebSite structured data — updated identically in the page head and the homepage's own SEO component.
- Visible fallback: the homepage's existing headline and paragraph delivered in the initial page, identical to what visitors see; the app replaces it on load. No hidden text, no design or wording change.

**Phase 5 — Google Search Console and removals**
- You approve connecting Search Console; we verify ownership with a tag on the homepage and submit the corrected sitemap.
- Then inspect agent and listing URLs. For any indexed: they will already return sign-in + "do not index", so Google drops them on recrawl; for faster removal, use Search Console's Removals tool on the `/agent/` and `/property/` prefixes.

**Testing before anything goes live**
- Private test copy: signed-out checks that every private page and every backend lookup above returns nothing; signed-in checks (as you) that Success Hub, listings, Hot Sheets, agent profiles and Communications still work; token links still open their one item.
- I will show you the before/after results and the exact changes for approval. No emails sent.

## Technical details
- New migration (for Weborik's Supabase migration too): revoke `anon` SELECT on `listings_public`, `dcmls_listings_public`, `agent_buyer_coverage_areas`, `listing_stats`, `teams`, `team_members`, `email_templates`; revoke `anon` EXECUTE on `get_public_agent_profile`, `get_newest_verified_agents`, `get_verified_agent_ids`, `get_public_listing_agent`, `is_email_registered_with_aac` (replace with a non-enumerating variant); review remaining anon-executable SECURITY DEFINER functions (~100 listed) and drop anon EXECUTE where not needed by sign-in/activation/token flows.
- Token-scoped RPCs for Hot Sheet and share links return a single row.
- Netlify: `X-Robots-Tag: noindex` headers for private paths; `/property/*` edge function (social previews) stops serving listing data to anonymous bots if social posts become members-only.
- `sitemap` edge function replaced by a static `public/sitemap.xml`; `netlify.toml` proxy removed.
- `index.html` + `src/pages/AllAgentConnectHome.tsx` `<Seo>` updated together; static fallback markup inside `#root`.
- Frontend edits go live on save, so all work is staged in a private copy until approved; the migration and edge-function changes are applied only after approval.
