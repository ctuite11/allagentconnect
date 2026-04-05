

# Use Uploaded Homepage Screenshot as OG Image

## Problem
The current OG image has visibility issues (bottom half too dark). The user has provided a clean homepage screenshot that already looks correct — bright, branded, with the hero section clearly visible.

## Solution
Use the uploaded screenshot (`Screen_Shot_2026-04-04_at_9.36.09_PM.png`) directly as the OG image. Crop/resize to exactly 1200×630 and export as `public/og-image.jpg`.

## Steps

1. Copy the uploaded screenshot to a working directory
2. Use Python/Pillow to resize/crop to exactly 1200×630 (the image is already close to this aspect ratio)
3. Export as optimized JPEG to `public/og-image.jpg`
4. QA — verify the image looks clean at thumbnail scale

## What the OG image will show
- Full homepage hero: dark background, person on couch with laptop
- "The private network where agents share pre-market intelligence" headline
- AAC monogram + wordmark in top-left
- "Verified Agent Network" pill
- "Request access" button
- No cookie banner (the uploaded screenshot is already clean)

## Files changed
- `public/og-image.jpg` (replaced with the uploaded screenshot)

No code changes needed — all meta tag references already point to this file.

