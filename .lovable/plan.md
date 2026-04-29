Plan:

1. Restore the Hot Sheet card component to match the screenshot layout/structure
   - Use the existing `HotSheetCard` card with the screenshot-style large collage image area, footer name line, and second-line right-aligned View button.
   - Do not move the View button, change the footer structure, or alter card spacing beyond restoring the screenshot state.

2. Keep only the requested typography fix
   - Change the Hot Sheet name/title typography to:
     `text-[14px] font-medium text-neutral-800 leading-snug`
   - Remove/avoid stronger title styling such as `text-[16px]`, `font-semibold`, `text-zinc-900`, or header-like treatment.

3. Ensure the Hot Sheets page renders those screenshot-style cards again
   - In `src/pages/HotSheets.tsx`, replace the current collection-card rendering path with the Hot Sheet card rendering that matches the screenshot.
   - Preserve existing data/loading behavior and navigation.
   - Do not change the page background, hero/header section, card grid layout, collage behavior, or View behavior except as needed to restore the screenshot cards.

Technical details:
- Primary files to edit after approval:
  - `src/components/HotSheetCard.tsx`
  - `src/pages/HotSheets.tsx`
- No database/backend changes are needed.