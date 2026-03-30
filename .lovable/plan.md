

# Fix Monogram Vertical Alignment in Logo SVGs

## Problem
In all four outlined SVG logo files, the monogram (⌘) sits ~2.7px too high relative to the "All Agent Connect" wordmark. The monogram group has no vertical offset, while the text centers lower in the 28px-tall canvas.

## Fix
Add a `translate(0, 2.7)` to the monogram `<g>` element in all four SVGs, shifting it down to vertically center-align with the text. Then re-render the PNGs from the corrected SVGs.

## Files to regenerate and re-upload (8 total)
- `aac-logo-white-outlined.svg` + `aac-logo-white.png`
- `aac-logo-black-outlined.svg` + `aac-logo-black.png`
- `aac-logo-green-white-outlined.svg` + `aac-logo-green-white.png`
- `aac-logo-green-black-outlined.svg` + `aac-logo-green-black.png`

## Approach
1. Rebuild each SVG with the monogram group changed from `<g transform="scale(0.8235)">` to `<g transform="translate(0, 2.7) scale(0.8235)">`
2. Re-render PNGs at 3x resolution from the corrected SVGs using `sharp`
3. Upload all 8 files to `brand-assets` bucket, overwriting the misaligned versions
4. Verify non-zero file sizes

## No project source files modified

