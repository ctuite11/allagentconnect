## Revert My Listings quick edit to its previous size/design

The recent commit `dc3bc4ae "Tighten my listings quick edit controls"` shrank the inline quick-edit row on the My Listings cards (smaller inputs, tighter gaps, smaller buttons/labels). Restoring the prior look means undoing just that commit's diff in `src/pages/MyListings.tsx`.

### Change
- Revert the quick-edit block in `src/pages/MyListings.tsx` to the version from commit `caa042d7` (one commit before the tightening).

### Restored details
- Wrapper: `flex flex-wrap items-end gap-2` (was tightened to `gap-1`/`gap-1.5`).
- Labels: `text-[11px]` uppercase, no `leading-none` clamp.
- Price field: width `w-[9.5rem] sm:w-44`, input `h-8`, `pl-6 pr-2`, right-aligned `text-[13px]`, `$` prefix at `left-2.5` `text-[13px]`, focus ring `ring-2`.
- Status select: trigger `h-8 w-[10.5rem]`, `text-[13px]`, items without the smaller `py-1.5 text-xs` overrides.
- Action buttons: Save `h-8 px-3 text-[13px]`, Cancel `h-8 px-2 text-[13px] text-zinc-600` (removes the smaller `h-7`/`text-[11px]` and hover override).
- Action group wrapper: `flex items-center gap-1.5 pb-0.5`.

### Out of scope
- No changes to `formatListingPriceDisplay.ts` or the price-display fix from `caa042d7` (that commit is kept).
- No changes to card layout, photos, agent/MLS metadata, or any other surface.
