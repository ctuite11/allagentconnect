Plan: Fix BuyerMapSearch selected-filter behavior

Scope
- Modify `src/pages/BuyerMapSearch.tsx` only.
- Do not change favorites, routes, database, map behavior, or card layout.

Changes

1. Restore Select all in the results header
- Add a small `Select all` button back into the single results header row.
- It will select all listings currently visible in the current results view.
- It will not alter sorting, filters, map behavior, or card checkbox behavior.

2. Preserve selected-state controls
- When `sessionKeptIds.size > 0`, show:
  - `X selected`
  - `Keep selected`
  - `Clear selected`
- When no listings are selected, hide:
  - `X selected`
  - `Keep selected`
  - `Clear selected`
- Keep the sort dropdown aligned on the far right.

3. Fix Clear selected behavior
- Update `Clear selected` so it:
  - clears `sessionKeptIds`
  - sets `showKeptOnly` to `false`
- This ensures all listings immediately repopulate and avoids the empty selected-only state after clearing.

4. Auto-exit selected-only mode when selection becomes empty
- Add a small effect watching `showKeptOnly` and `sessionKeptIds.size`.
- If selected-only mode is active and there are no selected ids, reset `showKeptOnly` to `false`.
- This also covers cases where individual card checkboxes are unchecked until none remain.

Technical details
- Reintroduce a `selectAllVisibleListings` helper near the existing `displayListings` / `toggleSessionKeep` logic.
- Add a `clearSelectedListings` helper for the two-step clear behavior.
- Keep `displayListings` filtering logic intact:
  - all mode: `sortedListings`
  - selected-only mode: `sortedListings.filter(id is selected)`
- Run TypeScript after implementation.