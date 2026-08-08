# Reorder Hot Sheets page sections

Put **My Hot Sheets** above **Buyer Hot Sheets** on the agent Hot Sheets page.

## Change
- `src/pages/HotSheets.tsx` (lines 966–967): swap the render order so `renderMyHotSheetsSection()` comes before `renderBuyersSection()`.

No data, matcher, email, or component changes — display order only.
