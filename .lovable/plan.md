

# Fix Monogram Alignment in Logo Assets (v4)

## Problem
The v3 logos overcorrected — the monogram is now too low. The green center square of the monogram needs to sit inline with the capital "A" of "All Agent Connect" (vertically centered with the text cap-height).

## Changes
1. **Reduce vertical offset** — pull the monogram back up from `translate(0, 7.0)` to approximately `translate(0, 4.0)` so the center square aligns with the midpoint of the capital letters
2. **Confirm brand green** — verify all monogram fills use `#22C55E` (Emerald 500), not the muted `#50C878` or `#059669`
3. Re-render 4 PNGs at 840px from corrected SVGs
4. Upload all 8 files as `-v4` versions to `brand-assets` bucket
5. Share new links for verification

## Files (all in storage bucket, no project source changes)
- `aac-logo-white-outlined-v4.svg` + `.png`
- `aac-logo-black-outlined-v4.svg` + `.png`
- `aac-logo-green-white-outlined-v4.svg` + `.png`
- `aac-logo-green-black-outlined-v4.svg` + `.png`

