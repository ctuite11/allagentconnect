## Scope
Make the online-status indicator green and consistent (dot + "Online" text) on the shared buyer/agent dashboard view, affecting both:
- **Agent side**: buyer presence shown to the agent (`buyerPresenceOnline`)
- **Buyer side**: agent presence shown to the buyer (`agentPresenceOnline`)

## Target file
`src/components/buyer/ClientDashboardView.tsx`

## Changes
1. **Buyer presence pill (agent view, ~line 273)**  
   Replace the gray neutral pill (`bg-neutral-50`, `border-neutral-200`, `bg-neutral-500` dot, `text-neutral-700` label) with a green success-themed pill:
   - Dot: `bg-emerald-500` with `ring-emerald-100`
   - Text: `text-emerald-700`
   - Pill background: `bg-emerald-50`
   - Pill border: `border-emerald-200`

2. **Agent presence dot (buyer view, ~line 411)**  
   Currently shows only a gray dot (`bg-neutral-500`) before the agent name. Update to match the dot+text pattern:
   - Change dot to `bg-emerald-500` with `ring-emerald-100`
   - Add inline "Online" label in `text-emerald-700` next to the dot, using the same compact styling (`text-[11px] font-medium uppercase tracking-wide`) as the buyer-side pill.

No other files or UI elements are touched.