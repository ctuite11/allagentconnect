Revert the hot sheet card footer icons in `src/pages/HotSheetBuyerDetail.tsx` so they are non-clickable display elements with tooltip-only hover hints. The whole card already navigates to the review page on click; no per-icon navigation is needed.

### `src/pages/HotSheetBuyerDetail.tsx` — hot sheet card footer (lines ~617–637)

- Revert the `View` `<button>` (just added) back to a non-interactive `<div>` with `pointer-events-none`, keeping AAC blue styling, the `Eye` icon, and "View" label. Add `title="View hot sheet"` for hover tooltip.
- Revert the `Favorites` `<button>` to a non-interactive `<div>` with `pointer-events-none`, keeping the rose Heart icon and "Favorites" label. Add `title="View favorites"` for hover tooltip. Remove its `onClick` handler.

Nothing else on the page or in shared components is touched. The buyer header card metrics strip (Sparkles / Eye / Heart / Flame / Messages) is already non-clickable with `title` tooltips, so no change there.