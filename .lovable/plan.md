# Project Details form cleanup

Changes to the developer Project Details page only. No database changes.

## Edits

1. **Remove Highlights** — drop the "Highlights (one per line)" textarea and stop writing highlights on save. The stored data stays in the database untouched.
2. **Address before About** — move the Location section above the description field so the order is: Project basics (name, slug, developer, architect) → Location (address, city, state, postal code, neighborhood) → About → Stage & availability → Building → Terms.
3. **Description renamed to About** — label and field heading become "About"; same underlying field.
4. **Neighborhood selection** — the neighborhood field becomes a dropdown populated from the existing neighborhood dataset for the entered city/state (same source used elsewhere in the app). If the city has no neighborhood data, it falls back to the current free-text input so nothing is lost.
5. **Expected completion: season + year** — two dropdowns only:
   - Season: Winter, Spring, Summer, Fall
   - Year: current year through +10
   The month dropdown is removed. Season is saved into the existing quarter field (Winter=1, Spring=2, Summer=3, Fall=4) and month is cleared on save, so public pages keep working; their completion label will read as the season.
6. **Terms trimmed** — remove the Parking and Pet policy inputs, leaving Buyer-agent compensation. Existing values in the database are left as-is and no longer edited here.

## Technical notes

- Single file changed: `src/pages/developer/DeveloperDetailsPage.tsx`.
- Neighborhood options come from `getAreasForCity` / `hasNeighborhoodData` in `src/data/usNeighborhoodsData.ts`.
- Completion display helpers in `src/lib/developments/format.ts` get a season label for quarters so the public page shows "Spring 2027" instead of "Q2 2027".
