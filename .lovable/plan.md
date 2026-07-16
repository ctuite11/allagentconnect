# Distinguish Buyers vs Agent Network sidebar icons

## Problem
In `src/components/agent-dashboard-v2/DashboardSidebar.tsx`, both the Buyers item (the buyer network entry, route `/agent/buyers`) and Agent Network (`/our-members`) use the same `Users` icon, so they visually blur together in the sidebar.

## Change
Single-file edit to `src/components/agent-dashboard-v2/DashboardSidebar.tsx`:

- Keep `Users` icon on **Agent Network** (unchanged).
- Swap the **Buyers** item icon from `Users` to a home-focused Lucide icon: `Home` (well-established, matches existing sidebar stroke weight; `House`/`HouseSearch` aren't part of the version pinned here — `Home` is the closest current-library match to your intent).
- Add `Home` to the `lucide-react` import list; leave `Users` in place for Agent Network.

## Explicitly not changing
- Labels ("Buyers", "Agent Network")
- Routes (`/agent/buyers`, `/our-members`)
- Ordering
- Any navigation behavior, tooltips logic, or badges

## Verification
- Expanded sidebar: Buyers row shows the home icon, Agent Network still shows people icon.
- Collapsed (icon-only) sidebar: the two icons are visibly different at a glance; hover tooltips still read "Buyers" and "Agent Network" respectively (tooltip logic untouched).
- Active-state highlight still applies on both routes.
