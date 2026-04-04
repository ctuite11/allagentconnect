

# Fix AAC Monogram Visibility on OG Image

## Problem
The monogram was added at ~36px — far too small to be visible in social preview thumbnails (which render at ~300–400px wide). Facebook's debugger confirms it's invisible.

## Fix
Re-composite the monogram onto the existing hero photo at a much larger size (~80–100px) in the top-left corner, matching the homepage nav placement. Use the SVG source at `src/assets/aac-logo-master.svg`, render it in brand green (#50C878), and overlay it with enough size to be clearly visible even at thumbnail scale.

## Steps
1. Convert the AAC monogram SVG to a PNG at ~100px using cairosvg or Pillow
2. Overlay onto the existing `public/og-image.jpg` at top-left with ~40px padding
3. Export as optimized JPEG, overwriting `public/og-image.jpg`
4. QA the output to confirm visibility

## Files changed
- `public/og-image.jpg` (regenerated with visible monogram)

No code changes needed — references already point to this file.

