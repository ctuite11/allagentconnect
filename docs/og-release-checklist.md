# OG Image Release Checklist

> **Quick command**: `node scripts/generate-og-image.js`  
> *(Note: `npm run og:build` requires manual addition to package.json)*

---

## A) Pre-flight

- [ ] Confirm target OG filename (cache-busting): `public/og/aac-og-YYYY-MM-DD.png`
- [ ] Confirm OG size is **1200×630**
- [ ] Confirm `index.html` contains:
  - `og:image` → absolute URL to new filename
  - `og:image:width` → `1200`
  - `og:image:height` → `630`
  - `twitter:card` → `summary_large_image`

---

## B) Generate

```bash
# One-time setup (if needed)
npx playwright install chromium

# Generate OG image
node scripts/generate-og-image.js
```

- [ ] Confirm output created at: `public/og/<your-og-filename>.png`

---

## C) Visual QA (don't skip)

Open the PNG locally and verify:

- [ ] Wordmark is crisp (no blur/pixelation)
- [ ] "Connect" (silvery gray) is visible at small preview sizes
- [ ] Contrast holds up (no "washed out" grays)
- [ ] Safe margins (nothing too close to edges)
- [ ] Looks good at ~600px wide (simulate typical share preview)

---

## D) Wire it up

- [ ] Update `og:image` to the new filename in `index.html`
- [ ] Update `twitter:image` to the new filename
- [ ] Update `netlify.toml` headers for the new filename
- [ ] Update `scripts/generate-og-image.js` OUTPUT_PNG path
- [ ] Confirm the old OG filename is no longer referenced anywhere

---

## E) Commit + Deploy

```bash
git status  # Confirm the new PNG is tracked
git add public/og/<new-filename>.png
git commit -m "chore(og): update OG image YYYY-MM-DD"
git push
```

- [ ] Lovable: **Publish → Update**

---

## F) Post-deploy verification

- [ ] Open production OG image URL directly in browser:
  ```
  https://allagentconnect.com/og/<your-og-filename>.png
  ```
- [ ] Confirm it loads and is the new image
- [ ] Hard refresh / clear CDN cache if needed

---

## G) Social scraper validation (do these in order)

1. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
   - [ ] Scrape **twice** (click "Scrape Again" twice)
   - [ ] Verify it shows the new image

2. **Twitter/X Card Validator**: https://cards-dev.twitter.com/validator
   - [ ] Confirm `twitter:card=summary_large_image`

3. **LinkedIn Post Inspector**: https://www.linkedin.com/post-inspector/

4. **iMessage / Slack sanity check**:
   - [ ] Paste the link in a private Slack channel or iMessage
   - [ ] Confirm preview shows correctly

---

## H) Troubleshooting (if old image still shows)

1. Confirm `og:image` points to the new filename
2. Confirm the new PNG is actually deployed and publicly reachable
3. Scrape again (twice) in FB debugger
4. Wait out client-side caching by testing on a different device/browser
5. If OG tags are injected by JS (SPA), ensure they exist in server-delivered HTML (scrapers don't run JS reliably)

---

## Current Configuration

| File | Purpose |
|------|---------|
| `public/og/og-render.html` | HTML template for OG image |
| `scripts/generate-og-image.js` | Playwright script to render PNG |
| `index.html` | Meta tags for social sharing |
| `netlify.toml` | Headers for OG image caching |

---

## Brand Standards

- **Wordmark**: "All Agent" in Royal Blue (#0E56F5), "Connect" in Silvery Gray (#94A3B8)
- **Tagline**: "Where Real Deals Get Done" in near-black (#0F172A)
- **Background**: Pure white (#FFFFFF)
- **Layout**: Centered, text-only (no globe graphic)
