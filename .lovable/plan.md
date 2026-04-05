

# Replace OG Image with Homepage Screenshot (No Cookie Banner)

## Problem
The current OG image (brightened aerial photo) doesn't match the homepage. The user wants the actual homepage hero as the social share image — the guy on the couch with the headline text — but without the cookie consent banner.

## Solution
Use browser tools to screenshot the homepage at 1200x630 after dismissing or hiding the cookie banner, then save as `public/og-image.jpg`.

## Steps

1. **Navigate to homepage** in sandbox preview at 1200x630 viewport
2. **Dismiss the cookie banner** (click Accept or Essential Only) so it's not in the screenshot
3. **Capture screenshot** of the full hero section at exactly 1200x630
4. **Process with Python/Pillow** — crop/resize to exact 1200x630 if needed, export as optimized JPEG
5. **Overwrite `public/og-image.jpg`** — no code changes needed since all references already point to this file
6. **QA** — verify the image shows: hero photo (guy on couch), headline text, AAC branding in header, no cookie banner, no cropping issues

## What the OG image will show
- Full homepage hero: dark background, person on couch with laptop
- "The private network where agents share pre-market intelligence" headline
- AAC monogram + wordmark in top-left
- "Verified Agent Network" pill
- Request Access button
- No cookie banner
- No nav buttons that look out of place at thumbnail scale

## Files changed
- `public/og-image.jpg` (replaced with homepage screenshot)

No changes to `index.html`, `Seo.tsx`, or any other code — references already point to this file.

