
Fix the scroll container, not the sticky bar.

What I found
- `ListingSearch.tsx` already has the action bar set to `sticky top-0 z-30`.
- `AppShell.tsx` was changed to add `overflow-y-auto`, but the shell still uses `min-h-screen` and the flex column does not constrain height strongly enough.
- That means the page can still scroll at the document level, so the sticky bar never gets a stable scrolling ancestor.

Plan

1. Tighten `AppShell` so it owns vertical scrolling
- In `src/components/layout/AppShell.tsx`, change the outer shell from `min-h-screen` to a fixed viewport-height container such as `h-screen`.
- Add `min-h-0` to the right-side flex column so its child can actually shrink and become the scroll area.
- Keep `overflow-y-auto` on the inner content area.

Target structure:
```tsx
<div className="h-screen flex w-full">
  <DashboardSidebar ... />
  <div className="flex-1 flex flex-col min-w-0 min-h-0">
    <div className="flex-1 overflow-y-auto">
      {children}
    </div>
  </div>
</div>
```

2. Leave the search page sticky bar as-is unless a small offset is needed
- Keep the sticky action row in `src/pages/ListingSearch.tsx`.
- If the bar visually clips against the top edge after the shell fix, adjust only spacing/background, not behavior.

3. Verify no duplicate sticky controls remain
- Confirm `src/components/listing-search/ListingSearchFilters.tsx` no longer contains its own sticky header/reset row.
- The only sticky control area should be the unified action bar on the search page.

Why this should fix it
- `position: sticky` works relative to the nearest scrolling ancestor.
- Right now the document is still effectively scrolling.
- Constraining `AppShell` to viewport height and adding `min-h-0` makes the inner content pane the real scroll container, so the search action bar can pin correctly.

Technical details
- Root cause is layout containment, not the search bar markup.
- In flex layouts, `overflow-y-auto` often fails to become the actual scroller unless the parent chain is height-constrained and intermediate flex children use `min-h-0`.
- This is the least invasive fix because it preserves the current search-page UI and only corrects the shell mechanics.

Checks after implementation
- Listing Search action bar stays visible while scrolling filters.
- Sidebar still fills height correctly.
- Other AppShell pages still scroll normally inside the content pane.
- No double scrollbars appear on desktop.
