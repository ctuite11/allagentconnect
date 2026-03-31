

# Re-render All Green Monogram Assets with Correct Brand Green

## Problem
The green monogram PNGs in the storage bucket were rendered from an SVG that may have used the muted `#50C878` instead of the brand-correct `#22C55E` (Emerald 500). Need to verify and re-render all green monogram files.

## What I'll Do
1. Download `aac-monogram-green.svg` from the bucket and verify its fill color
2. If it uses anything other than `#22C55E`, update the SVG fill to `#22C55E` and re-upload
3. Re-render all 8 green monogram PNGs (16, 32, 64, 128, 180, 256, 512, 1024px) from the corrected SVG using `sharp`
4. Upload all files back to the `brand-assets` bucket, overwriting existing versions
5. Share direct download URLs for all 9 green monogram files (1 SVG + 8 PNGs)

## Deliverables
- `aac-monogram-green.svg` — verified `#22C55E`
- `aac-monogram-green-{16,32,64,128,180,256,512,1024}.png` — re-rendered at correct color

All files publicly accessible at:
`https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/aac-monogram-green-{size}.png`

## No project source files modified

