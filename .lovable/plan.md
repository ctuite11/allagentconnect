

# Fix Logo SVG Wordmark Character Spacing

## Problem
The outlined SVGs in storage have correct glyph path shapes but incorrect horizontal positioning. Each letter's `translate(x, ...)` value is too small, causing characters to overlap/compress. The screenshot shows "All Agent Connect" rendering as garbled text.

## Root Cause
When the font glyphs were extracted, the advance widths (horizontal spacing between characters) were calculated incorrectly — likely using raw font units without proper scaling to the SVG coordinate system.

## Fix
1. **Download the Manrope ExtraBold font** and re-extract glyph outlines with correct advance width calculations
2. **Rebuild all 4 outlined SVGs** with properly spaced character positions — each glyph's x-translate must account for the font's advance width scaled to the target size (roughly 20px cap height)
3. **Also fix the monogram vertical alignment** (apply the `translate(0, 2.7)` offset that was planned but may not have been applied in the current files — the current SVG shows `scale(0.8235)` without the vertical shift)
4. **Re-render PNGs** from the corrected SVGs at 3x resolution
5. **Upload all 8 files** to the `brand-assets` bucket, overwriting the broken versions

## Variants
| File | Monogram | Wordmark |
|------|----------|----------|
| `aac-logo-white-outlined.svg` + `.png` | White | White |
| `aac-logo-black-outlined.svg` + `.png` | Black | Black |
| `aac-logo-green-white-outlined.svg` + `.png` | Green | White |
| `aac-logo-green-black-outlined.svg` + `.png` | Green | Black |

## Technical Approach
- Use Python `fonttools` to extract each glyph's outline AND its `hmtx` (horizontal metrics) advance width
- Scale advance widths by `target_font_size / units_per_em` to get correct pixel spacing
- Include proper kerning if available in the font's GPOS table
- Compose SVGs with the monogram group at `translate(0, 2.7) scale(0.8235)` and properly-spaced wordmark paths
- Render PNGs via `cairosvg` or `sharp`

## No project source files modified
All output overwrites existing files in the `brand-assets` storage bucket.

