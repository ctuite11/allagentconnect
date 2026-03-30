

# Export AAC Monogram in All Colors and Sizes

## What
Generate the AAC command monogram (⌘ symbol) as standalone files in **4 color variants** × **8 sizes** + **4 SVGs** = **36 files total**. Upload all to the `brand-assets` storage bucket.

## Color Variants
| Variant | Fill Color |
|---------|-----------|
| Green | #50C878 |
| White | #FFFFFF |
| Black | #000000 |
| Blue | #0E56F5 |

## Sizes (PNG)
16, 32, 64, 128, 180, 256, 512, 1024px — square, transparent background.

## SVGs
One scalable SVG per color variant (4 files), using the existing command monogram path data from `AACMonogram.tsx`.

## File Naming
- SVGs: `aac-monogram-{color}.svg`
- PNGs: `aac-monogram-{color}-{size}.png`

Example: `aac-monogram-green-512.png`, `aac-monogram-blue.svg`

## Technical Approach
1. Build SVGs from the existing monogram `viewBox="0 0 34 34"` path data with each fill color
2. Use Python (Pillow/cairosvg) to render PNGs at each size from the SVGs
3. Upload all 36 files to `brand-assets` bucket via Supabase Storage API
4. Provide permanent public URLs

## No project files modified
All output goes to the `brand-assets` storage bucket.

