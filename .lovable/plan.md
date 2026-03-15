

# Sidebar Visual Updates

Three changes to `DashboardSidebar.tsx`:

1. **Logo**: Replace the green square placeholder with the `AACMonogram` component (the command symbol) in `text-emerald-400` — matches the brand's green monogram variant.

2. **Section labels**: Change "Main Menu" label from `text-zinc-500` to `text-white` (or `text-zinc-300` for slight softness).

3. **Active state**: Remove the emerald vertical accent bar. Instead, make the active item's **icon** AAC Blue (`text-[hsl(221,92%,51%)]`). Text stays white.

### Files modified
- `src/components/agent-dashboard-v2/DashboardSidebar.tsx`

### No files touched
- `AgentDashboard.tsx`, routes, homepage — all untouched.

