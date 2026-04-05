

# Fix OG Image: Add Visible Logo and Text

## Problem
The Facebook debugger confirms the og-image.jpg is rendering (couch photo shows), but there is no visible AAC monogram or text on the image. It's just a dark photo with no branding. Additionally, Facebook is returning a 403 — likely a hosting-level issue on the production domain, not a robots.txt problem (robots.txt correctly allows facebookexternalhit).

## Solution
Regenerate `public/og-image.jpg` using Python/Pillow with:
1. The current hero photo as the base (brightened for visibility)
2. The AAC monogram rendered from SVG at ~100px in brand green (#22C55E), placed top-left with ~40px padding
3. White "All Agent Connect" text next to the monogram (matching the homepage lockup)
4. A subtle dark gradient at the bottom with a tagline for legibility

## Steps

1. **Load the current og-image.jpg** (the hero screenshot)
2. **Boost brightness ~1.5x** so the subject is clearly visible at thumbnail scale
3. **Render the AAC monogram SVG** to a ~100px PNG using cairosvg, in brand green (#22C55E)
4. **Overlay monogram** at top-left (~40px padding), matching homepage nav placement
5. **Add "All Agent Connect" text** in white, to the right of the monogram, using available system font (DejaVu Sans Bold or similar), ~36px
6. **Add subtle bottom gradient** (dark-to-transparent) with small tagline text if needed
7. **Export as optimized JPEG** to `public/og-image.jpg`
8. **QA** — verify monogram and text are clearly visible at 300px wide (thumbnail scale)

## 403 Issue (Separate)
The Facebook 403 is likely caused by Lovable's hosting returning a 403 to Facebook's crawler on the HTML page (not the image). The `social-preview` edge function should handle this by serving server-rendered meta tags. This may need investigation after the image fix, but the image itself loads fine based on the preview shown.

## Files changed
- `public/og-image.jpg` (regenerated with visible branding)

No code changes needed.

