# Fix: Desktop sidebar hover tooltips clipped by `overflow-hidden`

## Root cause (desktop)
On desktop the collapsed `<aside>` in `src/components/agent-dashboard-v2/DashboardSidebar.tsx` (line 219) has `overflow-hidden`. Our `TooltipContent` in `src/components/ui/tooltip.tsx` currently renders **inline** — it is NOT wrapped in Radix `Portal` — so the label positioned `side="right"` is clipped by the aside's own overflow. No z-index change fixes this; the previous z-[100] bump was a no-op.

## Fix
Wrap `TooltipPrimitive.Content` in `TooltipPrimitive.Portal` inside `src/components/ui/tooltip.tsx`. That is the shadcn default and matches `DialogContent` / `PopoverContent` behavior. Every existing tooltip call site keeps working with no other change — the label just renders into a portal at `document.body` and floats over the page.

## Verification
Desktop, sidebar collapsed → hover each nav icon and Sign Out → label appears fully to the right of the sidebar, not clipped, not behind page content.
