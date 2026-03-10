

# Fix: Make red neighborhood MapPin subtle (outline only)

The red neighborhood `MapPin` currently renders as an outline icon (lucide default), same style as the blue city pin. Both are already outline-only — no `fill` prop is set on either.

The user wants them visually consistent. The current code already has both as outline icons. The only difference is color: `text-primary` (blue) vs `text-red-500` (red).

If the red appears bolder than expected, it may be because `red-500` is visually heavier than the primary blue. I'll change it to `text-red-400` for a subtler, more balanced appearance matching the blue pin's visual weight.

Also applying the previously approved spacing fix: info row `mt-1` → `mt-0.5`.

## Changes (SearchListingCard.tsx)

1. **Line 296**: Change `text-red-500` → `text-red-400` on the neighborhood MapPin for a subtler red that balances with the blue city pin.
2. **Line 326**: Change info row margin from `mt-1` → `mt-0.5` to tighten spacing between city/neighborhood and listing number.

