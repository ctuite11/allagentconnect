

# Update Logo Assets to Use Correct Brand Green

## Problem
The logo files in the `brand-assets` bucket use `#50C878` (pastel green) for the monogram, but the brand standard specifies `#22C55E` (Emerald 500) — a brighter, more saturated green. This mismatch makes the exported logos look muted compared to the in-app UI.

## Fix
Replace `#50C878` with `#22C55E` in all logo and monogram assets in the `brand-assets` bucket.

## Files to update

**Logo lockups (8 files):**
- 4 outlined SVGs: swap monogram fill from `#50C878` → `#22C55E`
- 4 PNGs: re-render from corrected SVGs

**Standalone monograms — "green" variant (9 files):**
- `aac-monogram-green.svg`: update fill to `#22C55E`
- 8 PNGs (`aac-monogram-green-{16,32,64,128,180,256,512,1024}.png`): re-render

**Total: 17 files** overwritten in storage.

## Steps
1. Download current outlined SVGs and monogram SVG from bucket
2. Replace all `#50C878` fills with `#22C55E`
3. Re-render all PNGs using `sharp` at original sizes
4. Upload all 17 files, overwriting existing versions
5. Verify non-zero file sizes

## No project source files modified

