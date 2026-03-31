
## Plan

Yes — I should give you new links for the corrected lockups.

### What I’ll change
- Re-open the latest outlined logo assets in the storage bucket
- Move the monogram down further so its visual center aligns with the green inner square, not just the overall wordmark height
- Re-export the matching PNGs from those corrected SVGs

### Why new links
- Reusing the same filenames can keep showing stale cached images
- I’ll publish versioned files so you can compare them immediately without cache issues

### Assets to regenerate
- `aac-logo-white-outlined-v2.svg`
- `aac-logo-black-outlined-v2.svg`
- `aac-logo-green-white-outlined-v2.svg`
- `aac-logo-green-black-outlined-v2.svg`
- Matching `-v2.png` files for all four

### Calibration approach
- Start from the most recent logo files
- Increase the monogram Y offset beyond the current `translate(0, 2.7)`
- Align by the green center square as the reference point
- Verify all 8 outputs visually before sharing links

### What I found in the codebase
- The app itself is not using these storage URLs directly right now
- `src/components/brand/Logo.tsx` uses the local `aac-logo-master.svg`
- `src/components/ui/AACMonogram.tsx` uses an inline SVG
- So this is an exported asset correction, not an in-app component change

### Result
I’ll give you a fresh set of versioned URLs for the corrected logos so you can verify the alignment cleanly.
