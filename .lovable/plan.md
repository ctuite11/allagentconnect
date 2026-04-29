I’ll make a single targeted update in `src/components/HotSheetCard.tsx` without changing the card structure or moving elements.

Changes:
- Keep `Hot Sheet Name: {name}` on the first line, left aligned.
- Keep `View` on the second line, right aligned.
- Keep the same clickable card behavior and image-led layout.
- Keep the title at compact label scale, 14px / `font-semibold`.
- Reduce only the bottom padding below the View row so there is less empty space under it.

Technical adjustment:
- The title is already at `text-sm font-semibold`, which matches the 14–15px target.
- I’ll reduce the bottom content wrapper from `pb-4` to a tighter value such as `pb-2`, preserving the current `gap-2`, `px-5`, and `pt-4` so View stays in the same right-aligned second-row position.