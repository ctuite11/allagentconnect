## Goal (mobile ≤ lg)

The price currently sits with a large gap above the photo because the outer grid uses `gap-y-6` and the mobile price wrapper adds `mb-2`. Result: ~32px between price baseline and the photo. Target: price sits tight (~4–6px) directly above the photo, still left-aligned.

Desktop layout is unchanged.

## Change

**`src/pages/PropertyDetail.tsx`** (mobile price block, ~line 618)

- Remove the `mb-2` bottom margin.
- Add a negative bottom margin on mobile to cancel the parent grid's `gap-y-6` and pull the photo up close: e.g. `mb-1 -mb-4` won't compose cleanly, so use `mb-0` on the wrapper plus a mobile-only negative margin on the photo row (order-2) — `-mt-5 lg:mt-0` — so the visible gap becomes ~4px.

Concretely:
- Line 618 wrapper: `className="order-1 min-w-0 lg:hidden"` (drop `mb-2`).
- Line 628 photo wrapper: prepend `-mt-5 lg:mt-0` so the photo tucks up under the price on mobile only, without touching desktop's `row-start-2` spacing.

No other rows, no desktop tokens, no PropertyHeader/PropertyFactsRow changes.

## Verification

At 384px width on `/property/L-1223`: price sits ~4–6px above the top edge of the photo, still left-aligned. Address remains above the facts row. Desktop (≥1024px) unchanged.
