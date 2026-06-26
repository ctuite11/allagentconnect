# Mobile sidebar — show labels next to icons

## Root cause

`src/components/agent-dashboard-v2/DashboardSidebar.tsx` initializes:

```ts
const [collapsed, setCollapsed] = useState(() => routeContext === "workspace");
```

For workspace routes (Search, Buyers, Hot Sheets, etc.) `collapsed` starts as `true`. That state is then used everywhere — including inside the **mobile off-canvas drawer**. So when a mobile user opens the menu on Search, the drawer renders the icon-only rail layout (no labels, monogram-only header, mini icons) even though it's 260px wide. Result: blank text column next to every icon.

The `collapsed` flag should only control the **desktop (lg+) rail width**. On mobile, the drawer is always full-width and must always render labels.

## Fix

Make `collapsed` lg-only:

1. Add a derived value, e.g. `const showCollapsed = collapsed && !mobileOpen;` — or read viewport via existing `useIsMobile` hook and force `collapsed=false` on mobile.
2. Pass `showCollapsed` (instead of `collapsed`) to:
   - `SectionLabel`
   - Each `<NavRow>` / `collapsed` prop
   - Header monogram sizing block
   - Collapse toggle button row
   - Sign Out row
3. Keep the toggle button itself hidden on mobile (it's only meaningful for the desktop rail). Wrap it in `hidden lg:flex`.
4. Leave the actual `collapsed` state intact so when the user closes the drawer and the layout returns to desktop, the rail keeps its previous state.

No other files change. Frontend-only.

## Verification

- Mobile (<lg): open the drawer on `/listing-search` → every icon shows its label ("Success Hub", "Search", "Comms", …), header shows the AAC wordmark, no toggle button.
- Desktop (lg+): rail still collapses/expands via the existing toggle on workspace routes. No regression.

## Technical details

Files touched:
- `src/components/agent-dashboard-v2/DashboardSidebar.tsx` — single component; ~6 references to `collapsed` swap to `showCollapsed`, plus `hidden lg:flex` on the collapse-toggle button.
