

# Fix Property Detail header — move logo up, reposition price

## File
`src/pages/PropertyDetail.tsx`

## Changes

### 1. Move AAC logo closer to top
Reduce padding on the branding row from `pt-3` to `pt-1` so the logo sits near the very top of the page content area.

### 2. Reposition price to right-align above the hero image's right corner
Currently the price sits in the same row as the address. Instead, restructure the header block so the price block is positioned at the far right, immediately above the hero image — visually anchored to the top-right corner of the photo.

The address row and price block will remain in the same `flex justify-between` container (line 454), but the container's bottom padding will be reduced (`pb-4` → `pb-2`) to bring the price closer to the photo's top-right corner, making it feel anchored there.

### Layout result
```text
[AAC logo (moved higher, pt-1)]

[← back]

[pin + address ...................... price]
[...................................... $/sf]
[hero image --------------------------------]
```

### Technical details
- Line 428: change `pt-3` → `pt-1`
- Line 453: change `pb-4` → `pb-2` to tighten gap between price row and hero image
- All changes in `src/pages/PropertyDetail.tsx` only

