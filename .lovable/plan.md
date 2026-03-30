

# Generate White and Black "All Agent Connect" Logo Files

## What
Generate two standalone SVG logo files — the full AAC brand lockup (command monogram + "All Agent Connect" wordmark) — in white-on-transparent and black-on-transparent variants. Save them to `/mnt/documents/` for download.

## Deliverables

1. **`aac-logo-white.svg`** — White monogram + white "All Agent Connect" text on transparent background
2. **`aac-logo-black.svg`** — Black monogram + black "All Agent Connect" text on transparent background

Both use:
- The command symbol (⌘) monogram from `AACMonogram.tsx`
- "All Agent Connect" wordmark in Manrope Extra Bold, tracking tight
- Horizontal lockup layout matching the current brand standard

## Technical Approach
- Write SVGs directly using the existing monogram path data
- Embed the Manrope font reference (or use a web-safe fallback for portability)
- Output to `/mnt/documents/` as downloadable files

## Files
- No project files modified
- Output: `/mnt/documents/aac-logo-white.svg` and `/mnt/documents/aac-logo-black.svg`

