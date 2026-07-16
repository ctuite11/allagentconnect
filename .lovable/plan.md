# Fix: Collapsed sidebar hover tooltips render behind page

## Problem
When the sidebar is collapsed, hovering a nav icon shows a Radix tooltip with the item label ("Dashboard", "Agents", etc.). The tooltip is appearing behind page content instead of floating above it.

## Root cause
In `src/components/agent-dashboard-v2/DashboardSidebar.tsx`, the sidebar container uses `z-50`. The tooltips render via Radix portal at `z-50` as well (nav items) and the Sign Out tooltip has no z-class at all. When the tooltip portal lands at the end of `<body>`, sibling stacking contexts on the page (dialogs, sticky headers, `AppShell` main pane) can paint over a `z-50` tooltip — and always over the unclassed Sign Out tooltip.

## Fix
Bump the two `TooltipContent` elements above every in-page layer:

1. Nav item tooltip (line 134): change `z-50` → `z-[100]`.
2. Sign Out tooltip (line 310): add `z-[100]`.

No behavioral or layout changes; both tooltips already use `side="right"` with correct styling. Scope stays inside `DashboardSidebar.tsx`.

## Verification
- Collapse the sidebar, hover each nav icon and Sign Out → label floats to the right, fully visible, not clipped by main content.
- Expanded sidebar unchanged (tooltips only render when `collapsed`).
