## Goal

On the Edit Search results page (map split view), put **all action buttons on a single row** that spans the full content width — extending across both the map column and the cards column. The Sort control stays on its own line below.

## Layout (map split view)

Row 1 — Header (unchanged):
- Left: back arrow + "Edit Search"
- Right: "{N} listings found" pill

Row 2 — Single-line action bar, full content width (over map + cards):
- Left cluster: Select All · Keep Selected · Save as Hot Sheet · Share Selected (when items selected) · selected-count chip
- Right cluster: View: [Map | List] toggle
- All on one line; allow horizontal room since the row extends over the map. No wrapping at the current ≥1280px viewport. (At narrow widths, fall back to wrap.)

Row 3 — Sort, right-aligned, on its own line directly below the action bar.

Row 4 — Map (left 40%) + Cards (right 60%) grid, map height matches cards height (already in place).

## Implementation notes (single file)

`src/pages/ListingSearchResults.tsx`:
- In `renderAgentToolbar()` (used for both views per current code), keep the existing single-row action bar but remove the `flex-wrap` constraint on large screens so all buttons stay on one line. Move the View toggle into the same row's right cluster (already there).
- Keep Sort on its own line below (already there).
- Ensure the toolbar container spans the full `max-w-[1400px]` content width above the split grid (already true — it's outside the grid).
- No business logic changes. List view toolbar untouched.

## Out of scope

- Google Maps "Oops" error in screenshot is a Maps API key/referrer issue, not layout.
- No data, routing, or component-API changes.
