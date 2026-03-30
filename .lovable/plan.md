

# Regenerate Logo SVGs with Outlined Paths + PNG Exports

## Problem
Current SVGs use `<text>` elements referencing Manrope font. Gmail and most external environments don't have Manrope installed, so the wordmark falls back to Arial.

## Solution
Regenerate all four logo variants with the "All Agent Connect" wordmark converted to **outlined vector paths** (no font dependency), plus export **high-res PNG versions** (3x / ~840×120px). Upload all eight files to the `brand-assets` storage bucket.

## Deliverables (8 files)

| File | Format | Monogram | Text |
|------|--------|----------|------|
| `aac-logo-white-outlined.svg` | SVG | White | White |
| `aac-logo-black-outlined.svg` | SVG | Black | Black |
| `aac-logo-green-white-outlined.svg` | SVG | Green | White |
| `aac-logo-green-black-outlined.svg` | SVG | Green | Black |
| `aac-logo-white.png` | PNG | White | White |
| `aac-logo-black.png` | PNG | Black | Black |
| `aac-logo-green-white.png` | PNG | Green | White |
| `aac-logo-green-black.png` | PNG | Green | Black |

## Technical Approach
1. Copy the Manrope font file from the skill namespace to `/tmp`
2. Use Python (`fonttools` + `Pillow`) to:
   - Extract glyph outlines for "All Agent Connect" from Manrope ExtraBold
   - Convert to SVG path data with correct spacing and weight 800 metrics
   - Compose full lockup SVGs (monogram paths + outlined wordmark)
3. Render PNGs at 3x resolution using the outlined SVGs
4. Upload all 8 files to the `brand-assets` bucket via Supabase Storage API

## No project files modified
All output goes to `brand-assets` storage bucket as downloadable public URLs.

