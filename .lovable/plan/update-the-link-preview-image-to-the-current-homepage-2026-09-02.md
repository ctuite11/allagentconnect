# Update the link-preview image to the current homepage

## What's wrong

The image that shows up when you share allagentconnect.com in texts, Facebook, or iMessage is a stale screenshot of the **old** hero: "The private network where agents share pre-market intelligence."

The live homepage now reads:

- "ONE NETWORK. ALL AGENTS." (green second line)
- "Connecting verified agents across all brokerages to share off-market and coming-soon opportunities, buyer demand, and market intelligence — giving their clients a competitive edge."
- Logo lockup now includes the "Massachusetts" line, and the nav shows Request Access + Login.

Confirmed by comparing the current preview-image file against a fresh capture of the live homepage.

## Fix

1. Capture a clean 1200x630 shot of the current homepage hero — cookie banner dismissed, no scrollbars, fonts fully loaded, deviceScaleFactor 2 then downscaled for crisp text.
2. Replace the shared preview image with that capture (same filename, so no links break).
3. Bump the cache-busting version stamp everywhere the preview image URL is referenced, so Facebook, Google, and phone messaging apps fetch the new file instead of their cached copy.
4. Re-scrape the URL after publish so the new image starts showing immediately (existing previews already cached on a given device may take longer to refresh).

## Technical details

- Replace `public/og-image.jpg` (1200x630, JPEG, kept under ~300KB).
- Bump `?v=` stamp in:
  - `index.html` — `og:image`, `og:image:secure_url`, `twitter:image`
  - `src/lib/branding.ts` — `aac.ogImage`
- No changes to `Seo.tsx` logic, the `social-preview` edge function, or per-listing OG images.
- DCMLS (`directconnectmls.com/og-image.jpg`) is a separate brand entry and is left untouched unless you want it refreshed too.
