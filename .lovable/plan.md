# Privacy and Google Indexing Audit — Findings and Recommended Fixes

Read-only. Nothing was changed. Checks were run against the live allagentconnect.com, signed out, as a normal browser, as Googlebot and as Facebook's preview crawler.

## Findings

**1. Agent profiles (/agent/AAC-0497) are open to anyone.**
- The page returns "OK" (200) to signed-out visitors and to Googlebot. The site sends no sign-in requirement for this address.
- The page tells Google "index, follow". Its canonical points to the homepage, but that's only a hint, so Google can still index the page.
- The profile data comes from a public lookup that returns any agent's profile by AAC code, including hidden and invited agents. I confirmed this in the earlier review.

**2. Property pages (/property/...) expose listing details in several places.**
- A server-side social-preview step runs on every /property/ address. It writes the address, price, beds/baths and description into the page title and preview tags before any JavaScript runs. Example tested: "$2,995,000 · 220 Dorset Road, Newton, MA" with the full description.
- Googlebot, Facebook and anyone who views the page source can read this without signing in.
- The listing data feed is also readable without signing in: 68 listings, including 17 Off Market and 22 Coming Soon.

**3. How Google finds these pages.** The sitemap no longer lists them. The likely sources are:
- the old sitemap, which listed 528 agents and 50 listings until this month. Google remembers those addresses.
- Facebook/social listing posts and listing-share emails that link to /property/ pages.
- agent and listing pages linking to each other.

**4. Sitemap — correct.** It has 10 public pages: the original nine plus About, which you approved. No agents or listings. It is served as XML.

**5. robots.txt — managed by Cloudflare, not the site.** It allows all crawlers and has no "Sitemap:" line. Nothing in it blocks or protects private pages. That's fine, because robots.txt shouldn't be used for privacy anyway.

**6. Indexing directives point the wrong way.**
- The whole site sends an "index everything" header (`X-Robots-Tag: all`).
- Every app page, including agent and property pages, starts with the homepage's "index, follow" tag and homepage canonical.

**7. Old setups that cause conflicts.**
- The old backend sitemap is no longer used, but Google still remembers its addresses.
- directconnectmls.com and the lovable.app copy serve the same pages.
- The Facebook preview step on /property/* was built for public sharing. It now conflicts with keeping the network private.
- /about returned a redirect (301) in this check. I'll confirm where it goes during the fix.

**8. "Discovered" vs "indexed".**
- Search Console's 381 non-indexed URLs include 336 agent and 25 property addresses. Those are pages Google discovered or crawled but chose not to index. That's good, but they're still reachable.
- Of the 231 indexed URLs, I can't tell from here how many are agents or listings, because Search Console isn't connected to this project. Please export the "Indexed pages" list (or the Pages report filtered to /agent/ and /property/) and share it. Any agent or property address in that list is actually in Google's results.

## Recommended fixes (safest order, each needs your approval)

**Step 1 — Tell Google to drop private pages right away. Low risk, no effect on members.**
- Send a "noindex" header on /agent/*, /property/*, /listing/*, /hot-sheet* and other app addresses.
- Keep "index" on the 10 public marketing pages.
- Remove the site-wide "index everything" header.
- Google needs to be able to crawl these pages to see the noindex, so robots.txt will not block them at this stage.

**Step 2 — Stop property details from leaking before sign-in.**
- Turn off the social-preview step for /property/*. Shared links would then show the generic AAC preview instead of the address, price and photo.
- This affects Facebook/social listing posts and listing-share emails. Their links would still work, but would ask for sign-in once Step 3 is in place.

**Step 3 — Require sign-in for agent and property pages.**
- Signed-out visitors to /agent/:id and /property/:id would be sent to Login and come back after signing in.
- This changes what visitors see, but not how members use the app.

**Step 4 — Real protection on the backend.**
- Close the public agent-profile lookup and the public listings feed to signed-out users.
- This is a permissions change and is outside the "SEO only" scope you set earlier. It needs its own decision because it affects buyer Hot Sheet links, the homepage agent counts and share emails. I recommend it, but it won't be included unless you approve it separately.

**Step 5 — Clean up what Google already has.** Do this in Search Console yourself after Step 1 is live:
- Use the Removals tool with prefix requests for `https://allagentconnect.com/agent/` and `https://allagentconnect.com/property/`. This hides them for about 6 months while the noindex takes permanent effect.
- Ask Cloudflare to add `Sitemap: https://allagentconnect.com/sitemap.xml` to robots.txt.

## Testing before anything goes live
- Prepare the changes in a private test copy first.
- Confirm signed out and as Googlebot that agent and property pages send noindex and show no listing or agent details in the page source.
- Confirm the 10 marketing pages still say "index" and display normally.
- Confirm a signed-in agent can still open profiles and properties.
- Show you the results before making anything live.

## Technical details
- `netlify.toml`: add `X-Robots-Tag: noindex, nofollow` header rules for the private paths, remove the global `X-Robots-Tag = "all"`, and remove the `[[edge_functions]] path="/property/*" social-preview` entry. The function files stay in place so the change can be undone.
- `src/App.tsx`: wrap `/property/:id` and `/agent/:id` in the existing sign-in guard. Helmet sets `robots: noindex` on those pages.
- Step 4 (separate approval): change `get_public_agent_profile` and the grants on `listings_public` and `agent_profiles_public`. Weborik would need to carry this into the migration.
