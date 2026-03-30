

# Fix Brand Logo Assets — Reliable Text-to-Path Conversion

## Current Problem
Three attempts to convert "All Agent Connect" in Manrope ExtraBold to outlined SVG paths have all produced overlapping/garbled text. The `hmtx` advance width calculations keep being applied incorrectly, making every file in the `brand-assets` bucket unusable.

## Recommended Approach — Use Inkscape CLI

Instead of manually extracting glyph outlines and calculating advance widths with `fonttools` (which has failed 3 times), use **Inkscape's command-line text-to-path** conversion. This is the industry-standard method that handles all font metrics, kerning, and spacing automatically.

### Steps
1. **Install Inkscape** in the sandbox (`apt-get install inkscape`)
2. **Create a template SVG** with a `<text>` element using Manrope ExtraBold (install the font via `fc-cache`)
3. **Run `inkscape --export-text-to-path`** to convert the text to outlined paths with correct spacing
4. **Compose the full lockup** by combining the outlined wordmark with the monogram paths (with `translate(0, 2.7)` vertical alignment fix)
5. **Generate all 4 SVG variants** (white, black, green+white, green+black)
6. **Render 4 PNGs** at 3x resolution using `inkscape --export-png` or `cairosvg`
7. **Upload all 8 files** to the `brand-assets` bucket, overwriting the broken versions
8. **Verify** each file has non-zero size and correct rendering

### Why This Will Work
Inkscape's text-to-path engine uses the same rendering pipeline as desktop design tools (Figma, Illustrator). It reads the font's `hmtx`, `GPOS` kerning, and `OS/2` metrics tables natively — no manual calculation needed.

## Deliverables
8 files overwritten in `brand-assets` bucket:
- 4 outlined SVGs (font-independent, correct spacing)
- 4 high-res PNGs (3x density)

## No project source files modified

