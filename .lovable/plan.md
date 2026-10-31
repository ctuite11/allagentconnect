# SEO Audit — All Agent Connect (read-only findings + proposed fixes)

Nothing has been changed. Checks were run against the live allagentconnect.com as Googlebot.

## Findings

1. **Crawlable and indexable — yes.** Homepage returns 200, `robots` meta says `index, follow`, robots.txt allows Google (`search=yes`; only AI-training bots blocked). www and http correctly 301 to `https://allagentconnect.com/`. The main JavaScript file loads (200).
2. **Homepage text is invisible without JavaScript.** The initial HTML contains no headline, no description paragraph, no body text at all — only an empty app container. Google can render JavaScript, but it does so later and less reliably, and the page gives it nothing to read in the first pass. This is the biggest reason the homepage doesn't rank for "private network for real estate agents": those words appear nowhere in the delivered page.
3. **Title, description and structured data are out of date.**
   - Title is just "All Agent Connect".
   - Description: "professional collaboration platform... close deals faster" — no "private", "verified", or "network".
   - No structured data (zero JSON-LD blocks).
4. **Sitemap — valid but needs correction.**
   - 588 URLs: 11 public pages, 50 listings, **528 agent profiles**.
   - Agent profiles are included for **every** agent, with no check for hidden/unverified agents — agents who chose to be hidden from the directory are being advertised to Google. Needs fixing.
   - Listings are filtered by status only (active / coming soon / back on market); no check for private/off-market visibility flags. Needs a review.
   - Served with the wrong file type (`text/plain` instead of XML) through the site's proxy; Google usually tolerates it, but it should be fixed.
5. **Other technical issues.**
   - Canonical is `https://allagentconnect.com` (no trailing slash) while the sitemap and redirects use `https://allagentconnect.com/` — minor mismatch.
   - directconnectmls.com serves an identical copy (200) but its canonical points to allagentconnect.com, so it's not a duplicate-content risk.
   - The site has never been verified in Google Search Console here, so actual Google indexing status is unknown.

## Recommended plan (each step needs your approval)

1. **Homepage head tags only** (no visual change): set title "All Agent Connect | Private Network for Real Estate Agents", your proposed description on the meta, Open Graph and Twitter tags, canonical with trailing slash, and add Organization + WebSite structured data.
2. **Hidden, crawler-readable homepage summary**: put the existing headline and description text inside the initial page so Google sees it before JavaScript runs; the app replaces it on load, so the hero looks exactly the same.
3. **Sitemap privacy fix**: include only verified agents who are visible in the directory; exclude listings that aren't publicly visible; fix the XML file type. No change to listing permissions or member access — only what the sitemap lists.
4. **Connect Google Search Console** so we can submit the sitemap and see real indexing status.
5. Optional later: server-rendered pages (larger project) for stronger ranking.

## Technical details

- Step 1–2: `index.html` only (`<title>`, meta, canonical, JSON-LD, static text inside `#root`). Hero component untouched.
- Step 3: `supabase/functions/sitemap/index.ts` filters (agent visibility/verification columns and listing visibility to be confirmed by schema read before editing); Netlify proxy rule for `/sitemap.xml` content type. Deploying the sitemap function is a backend function change, so it is listed separately for approval.
- Frontend edits go live on allagentconnect.com automatically when saved.
