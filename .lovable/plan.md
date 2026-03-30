

# Fix Monogram Vertical Alignment in All Logo Files

## What
Add `translate(0, 2.7)` to the monogram group in all 4 outlined SVGs, then re-render PNGs and upload all 8 files to the `brand-assets` bucket.

## Steps
1. Download the current 4 outlined SVGs from the bucket
2. Update each SVG's monogram `<g>` from `scale(0.8235)` to `translate(0, 2.7) scale(0.8235)` — wordmark paths stay untouched
3. Re-render 4 PNGs at 3x resolution (840px wide) using `sharp-cli`
4. Upload all 8 files to `brand-assets` bucket, overwriting existing versions
5. Verify all files have non-zero size

## Files affected
- `aac-logo-white-outlined.svg` + `.png`
- `aac-logo-black-outlined.svg` + `.png`
- `aac-logo-green-white-outlined.svg` + `.png`
- `aac-logo-green-black-outlined.svg` + `.png`

No project source files modified.

