

# Fix: Three Layout/Icon Issues on My Listings Cards

## All changes in `src/pages/MyListings.tsx`

### 1. Status badge overlapping the Listed date

The `ListingStatusBadge` is currently absolutely positioned at `top-0 right-12` (line 654), which overlaps the right-side metadata (Listed date, Exp, DOM). Fix: move it into the right-side metadata column (lines 802-825) as the first element, above "Listed:", instead of using absolute positioning. Remove the absolute `div` from lines 654-656.

### 2. Open House / Broker Tour rows still below Quick Edit

The event rows (lines 733-799) are currently inside the center text stack as children stacked vertically below the price/Quick Edit row. To place them to the right of Quick Edit, wrap the price row and event rows together in a horizontal flex container.

**Current structure (simplified):**
```
<div> (price row - line 720)
  $1,375,000  Quick Edit
</div>
<div> (event rows - line 733+)
  🎈 Open House ...
  🚗 Broker Tour ...
</div>
```

**New structure:**
```
<div className="flex items-start gap-3"> 
  <div> (price + quick edit) </div>
  <span className="text-zinc-300">|</span>
  <div> (event rows stacked vertically) </div>
</div>
```

This places the events to the right of Quick Edit separated by a pipe character, matching the spec.

### 3. Broker Tour icon: replace SVG with car emoji

Replace `<BlueCarIcon className="h-3.5 w-3.5 shrink-0" />` on line 775 with `<span aria-hidden className="shrink-0">🚙</span>` (same pattern as the Open House balloon emoji). Also replace the action bar usage on line 607.

---

## Technical Detail

**Status badge (lines 654-656):**
- Delete the absolute-positioned `div` wrapper
- Insert `<ListingStatusBadge status={l.status} size="sm" />` as the first child inside the right-side metadata column (before line 804)

**Event row positioning (lines 686-799):**
- Wrap lines 720-729 (price display) and lines 733-799 (event rows) inside a single `flex items-start gap-3` container
- Add a `|` separator between them

**Broker Tour icon (lines 607 and 775):**
- Line 607: replace `<BlueCarIcon className="h-3.5 w-3.5" />` with emoji `🚙`
- Line 775: replace `<BlueCarIcon className="h-3.5 w-3.5 shrink-0" />` with `<span aria-hidden className="shrink-0">🚙</span>`
- Optionally remove the `BlueCarIcon` function (lines 13-23) if no other usages remain

| File | Changes |
|------|---------|
| `src/pages/MyListings.tsx` | Move status badge into right column; wrap price+events in horizontal flex; replace BlueCarIcon SVG with 🚙 emoji |

No other files changed. No backend changes.
