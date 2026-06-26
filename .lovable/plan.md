Update `src/components/property/PropertyFactsRow.tsx` so the property facts (Property Type, beds, baths, sqft, parking, DOM) render on a single horizontal line on mobile property detail.

Change:
- Replace `flex-wrap` with `flex-nowrap` and `overflow-x-auto` on the stats container so the row stays on one line and scrolls horizontally if width is constrained.
- Tighten horizontal gap on mobile (`gap-x-4 sm:gap-x-9`) so all 6 fact items fit on a typical phone width without scrolling.
- Add `shrink-0` / `whitespace-nowrap` to each fact item to prevent individual items from wrapping.
- Hide the scrollbar via `[&::-webkit-scrollbar]:hidden` for cleanliness.

No business logic changes. Scope limited to this one presentation component.