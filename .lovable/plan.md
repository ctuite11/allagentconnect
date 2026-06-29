# Fix property header layout on mobile

**Problem:** On the property detail page (mobile), the address ("15 Lincoln St, Arlington, MA 02476") wraps to four ugly lines while the price ("$2,350,000 – $2,500,000") sits squeezed beside it. The flex row tries to keep both on one line, forcing the address into a narrow column.

**Fix:** In `src/components/property/PropertyHeader.tsx` (the `PropertyHeaderRow` component), change the layout so address and price stack on mobile and only sit side-by-side on `sm:` and up.

Specifically:
- Wrapper row: `flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4` (override `propertyHeaderRow`).
- Address `<h1>`: drop `flex-1` on mobile (full width naturally); keep `min-w-0 sm:flex-1`.
- Price `<p>`: remove forced right-align on mobile — `shrink-0 text-left sm:text-right tabular-nums`.

Result on mobile: address renders on one/two natural lines full-width, price appears below it left-aligned. Desktop layout unchanged.

No other files touched. No business logic changes.
