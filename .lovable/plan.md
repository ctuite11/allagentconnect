# Coordinated Privacy Lockdown and Google Cleanup

This plan fixes the backend, the website pages, property previews and Google indexing together. All work happens in a private test copy first. Nothing goes live until you approve the test results.

## What was confirmed (read-only)
- Google has indexed 201 agent profiles and 24 property pages. This is from your Search Console report.
- Anyone who isn't signed in can read:
  - listings through `listings_public`, `dcmls_listings_public` and `seller_matches_public`
  - any agent's profile through `get_public_agent_profile`, including hidden and invited agents
  - single listings and their agents through `get_public_listing` and `get_public_listing_agent`
  - lists of verified agents through `get_verified_agent_ids` and `get_newest_verified_agents`
  - a "who is online" check through `get_agent_presence`
- About 100 backend functions can be run by signed-out visitors. Many only check things internally, but each one needs reviewing.
- These photo and file folders are open to anyone: listing photos, floor plans, agent headshots, agent logos, agent-match photos and email attachments.
- The property-preview step writes the address, price, description and photo into every /property/ page before it loads.
- The whole site tells Google "index everything", and agent and property pages say "index, follow".
- directconnectmls.com and allagentconnect.lovable.app show the same agent pages to signed-out visitors (they return 200 OK). They use the same backend, so the backend fix covers them too.

## The fix, in five parts

**1. Backend (the real protection)**
- Signed-out visitors lose read access to `listings_public`, `dcmls_listings_public` and `seller_matches_public`. Signed-in verified agents keep it, so nothing changes in the app for members.
- These functions become sign-in only, and only hand out verified, non-hidden agents:
  - `get_public_agent_profile`, `get_public_listing` and `get_public_listing_agent`
  - `get_verified_agent_ids`, `get_newest_verified_agents` and `get_agent_presence`
  - `get_listing_interest_signals`, `listings_within_radius` and `get_dcmls_listing`
- Buyer links keep working through the existing link-checking functions: `get_hot_sheet_by_token`, `resolve_share_token` and `accept_client_hot_sheet_invite`. These only return data when the link's code is valid. I'll confirm each one returns nothing beyond that sheet's or link's listings.
- Every signed-out-runnable function gets reviewed. Signed-out access is removed from anything that isn't needed before sign-in, such as sign-up, activation, link checks or the homepage count. The full list will be in the test report.
- Homepage numbers keep working through count-only functions that never return names or IDs.

**2. Photos and files**
- Listing photos, floor plans and agent-match photos: make the folders private and serve images through short-lived signed links for signed-in users and valid buyer links.
- This is the largest change: 13 places in the app build photo links. Old links already sent in Hot Sheet emails would stop showing images. For that reason I recommend doing photos as a second release once part 1 is live and steady. Old photo addresses are hard to guess, and once the pages that list them are locked, no one can find them.
- Headshots, logos and brand files stay public. Email images rely on them.

**3. Website pages**
- Signed-out visitors to /agent/:id, /property/:id, /team/*, /our-agents and the listing search are sent to Login and return to the page after signing in.
- Buyers opening a Hot Sheet or share link still see only that sheet or listing, through the shared-listing page that already handles those links.

**4. Property previews**
- Turn off the property-preview step for /property/*. Links shared on Facebook, in texts or in emails will show the generic AAC preview card instead of address, price and photo.
- The function files stay in place so the change can be undone.

**5. Google**
- Remove the site-wide "index everything" header.
- Add "noindex" to /agent/*, /property/*, /team/*, /hot-sheet*, /shared/*, /seller-listing/* and every signed-in page.
- The 10 public marketing pages keep "index" and stay in the sitemap.
- In Search Console (you do this): after release, submit Removals prefix requests for `/agent/` and `/property/`. This takes them out of results within about a day and keeps them out about 6 months while the noindex takes permanent effect. Also request removal of the same prefixes on directconnectmls.com if that property is verified.

## Effect on existing features
| Feature | After the change |
|---|---|
| Signed-in agents (search, profiles, listings, Hot Sheets, Communications) | Unchanged |
| Buyer Hot Sheet links and invites | Still work, showing only that sheet's listings |
| Listing-share emails and links | Open for valid share links. Links without a share code ask for sign-in. |
| Facebook/social listing posts | The link opens Login. The preview card is generic AAC. |
| Homepage statistics | Unchanged (counts only) |
| Public team and agent directory pages | Need sign-in |
| Hot Sheet emails | Unchanged in this release (images stay public until part 2) |

## Test matrix (private copy, before approval)
I'll run each check as a signed-out visitor, Googlebot, Facebook's preview crawler, a signed-in verified agent, a buyer with a valid Hot Sheet link and a buyer with an invalid link:
- agent profiles, including hidden, invited and unverified agents
- property pages for Active, Coming Soon, Off Market and Draft listings
- a direct request to each locked data feed and function
- the page source and preview tags on /property/
- the robots header on private pages and on the 10 marketing pages
- the homepage counts and the sitemap

Expected result: signed-out visitors and crawlers get no agent or listing data. Agents get full access. Buyers see only their own sheet or link.

No emails will be sent and no listings, members or preferences will change. Buyer flows will be tested with existing sheets, read-only.

## For Weborik's migration
- The database migration file (grants, function changes, view access) applies unchanged to the new backend.
- The `netlify.toml` changes: noindex rules, removal of the global header, and the property-preview step turned off.
- The page-access changes in the app code.
- Part 2 if approved: private folders plus the signed-link helper.
- Re-run the test matrix against the new environment before switching over.

## Technical details
- Migration: `REVOKE SELECT ... FROM anon` on the three views. `REVOKE EXECUTE ... FROM anon, public` on the listed functions. Add `auth.uid()` and `is_verified_agent` checks inside them. Filter to `verification_status='verified' AND NOT hidden`. Add count-only RPCs for homepage stats if they are missing.
- Netlify: drop `X-Robots-Tag = "all"`. Add `X-Robots-Tag: noindex, nofollow` blocks per private path. Delete the `[[edge_functions]] /property/*` entry.
- App: wrap `/agent/:id`, `/property/:id` and the team and directory routes in the existing sign-in guard with a return-to path. Keep `SharedListingGate` for token links.
- Tests: add database grant tests (anon denied, agent allowed, valid token allowed) next to the existing SQL tests.
