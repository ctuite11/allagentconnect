## Why it's not showing on mobile (or anywhere)

The strip I added last turn went into `src/pages/AgentDashboardV2.tsx`, but `/agent-dashboard` no longer renders that file. `App.tsx` routes `/agent-dashboard` → `SuccessHubDashboard` (in `src/pages/success-hub/SuccessHubDashboard.tsx`), and `/agent-dashboard-v2` redirects to `/agent-dashboard`. So the strip is effectively dead code and never renders on any device.

The "Recent Conversations" block on the live Success Hub is `DashboardCommunications`, rendered near the bottom of `SuccessHubDashboard.tsx`.

## Change

1. Remove the strip from `src/pages/AgentDashboardV2.tsx` (revert last turn's edit — that page is not on any live route).
2. Add the same Communications Center strip in `src/pages/success-hub/SuccessHubDashboard.tsx`, directly above the `DashboardCommunications` section, wrapped in an `AgentSectionCard` so it matches the surrounding cards on mobile and desktop.
3. Behavior unchanged from the previous spec: entire card is clickable → navigates to `/communications`; shows heading "Communications Center", the primary line, four category pills (Buyer Needs, Seller Needs, Renter Needs, General Discussions), and the smaller supporting line.
4. No changes to email logic, preferences, or `DashboardCommunications`.

## Verification

- Confirm the strip renders on `/agent-dashboard` immediately above Recent Conversations at desktop, tablet, and mobile widths.
- Confirm click anywhere on the card routes to `/communications`.
