# My Listings — Tighten Quick Edit Row

## Problem
When the Quick Edit row opens on a My Listings card, it renders much larger than the closed state (tall inputs, big PRICE/STATUS labels, oversized Save/Cancel), and the `$` sign sits flush-left while the number is right-aligned — creating the awkward "$&nbsp;&nbsp;&nbsp;343,344" gap shown in the screenshot.

The closed state shows price as a single compact line: `$343,344` followed by a small "Quick Edit" link in `text-sm`.

## Goal
Make the open Quick Edit row visually match the closed state — same height, same type scale, `$` immediately next to the number, no oversized labels.

## Changes (src/pages/MyListings.tsx, lines ~803–849)

1. **Remove the uppercase `PRICE` / `STATUS` labels.** They double the row height and aren't in the closed state.
2. **Price input**
   - Left-align text (remove `text-right`) so `$` sits directly next to the digits, matching `$343,344`.
   - Keep `h-7`, narrow width (`w-[7rem]`).
   - Keep the absolute `$` prefix and `pl-5`.
3. **Status select**
   - `h-7`, `w-[7.5rem]`, `text-[12px]`, no label above.
4. **Save / Cancel buttons**
   - Stay at `h-7`, but drop the `pb-0.5` wrapper so they align on the same baseline as the inputs (no label offset to compensate for anymore).
5. **Container**
   - `flex flex-wrap items-center gap-2` (was `items-end gap-1.5` to accommodate labels). Now everything is one tight row at the same height as the closed price line.

No logic, state, or handler changes — purely presentational tightening of the editing row.

## Out of Scope
- Closed-state markup
- Other listing card variants (Success Hub, Search results)
- Save/Cancel behavior
