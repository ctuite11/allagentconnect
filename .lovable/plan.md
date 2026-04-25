Plan: fix BuyerMapSearch card controls only

Scope
- Modify `src/pages/BuyerMapSearch.tsx` only.
- Do not change routes.
- Do not touch the database.
- Do not change filtering, favorites, navigation, map behavior, or listing data logic.

Changes

1. Replace the text Keep button with a fixed square control
- Location remains top-left of the listing image.
- Replace the current variable-width `Keep / Kept ✓` button with a fixed `28–32px` square button.
- No text inside the control.
- Use a rounded-sm / small-radius shape, not a circle.
- Default state:
  - white background
  - gray border
  - subtle shadow
  - neutral/gray check or empty state visual
- Selected state:
  - AAC primary blue background `#0E56F5`
  - white check icon
  - blue border
- Preserve existing behavior:
  - `toggleSessionKeep(listing.id)` still runs
  - `aria-pressed` remains tied to `isKept`
  - “Show kept only” continues to filter `sessionKeptIds`

2. Update the favorite heart color and sizing
- Keep favorite heart top-right.
- Keep `FavoriteButton` usage and favorite logic unchanged.
- Keep no circle/background wrapper.
- Ensure icon stays around 24px.
- Change saved/favorited color from Tailwind red to true favorite red:
  - `fill-[#FF2D55] text-[#FF2D55]`
- Default unsaved state remains:
  - `fill-white text-white`
- Keep only subtle drop shadow.

Technical details
- Add/use the existing Lucide `Check` icon import in `BuyerMapSearch.tsx` for the square keep control.
- Target the existing JSX block around the image overlay controls only:
  - current Keep button block around lines 1163–1181
  - current FavoriteButton block around lines 1183–1192
- If the saved heart color is controlled inside `src/components/FavoriteButton.tsx`, make the smallest necessary class update there only for `photoIcon` saved state. No behavior changes.

Validation
- Confirm JSX remains structurally valid.
- Run TypeScript/check command after applying.
- Report back with:
  - files modified
  - exact sections changed
  - confirmation no routes/database/unrelated files were touched
  - TypeScript result