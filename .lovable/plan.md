## What's happening

Two separate causes, both confirmed in the code:

**1. Logged out when you leave/close the browser**
`src/lib/tabScopedAuthStorage.ts` (loaded first in `src/main.tsx`) intercepts the auth token and redirects it from `localStorage` to `sessionStorage`. `sessionStorage` is wiped when the tab/browser closes, so every restart = signed out. It was added earlier to stop one tab from adopting another tab's account.

**2. Back button from an agent card**
In `src/pages/AdminApprovals.tsx` the agent card opens `AgentDetailsDrawer` via plain React state (`detailsAgent`) — no URL change, no history entry. So the browser Back button skips the drawer entirely and pops the page you were on before `/admin/approvals` (usually home), which renders signed-out chrome.

## The fix

**Session persistence**
- Change the auth-storage shim to keep the token in `localStorage` (durable across restarts) instead of `sessionStorage`, migrating any existing tab-scoped token back so you aren't signed out on the deploy.
- Keep the existing cross-tab safety net: `CrossTabSessionGuard` already detects an in-place account switch and offers Reload / Sign out. That covers the original problem without destroying persistence.
- Trade-off to be aware of: with `localStorage`, signing in as a test account in a second tab will again be visible to your admin tab — but you'll get the guard toast instead of a silent swap.

**Drawer + Back button**
- Drive the drawer from a URL search param on `/admin/approvals` (e.g. `?agent=<id>`): opening a card pushes a history entry, closing it (X, Esc, overlay) pops back to the clean admin URL.
- Browser Back then simply closes the drawer and leaves you on the admin list, with scroll position and filters intact.
- Existing behavior preserved: the auto-close/stale-selection reconciliation stays, it just clears the param instead of only the state.

## Technical notes

- Files: `src/lib/tabScopedAuthStorage.ts` (storage target + one-time migration back from the `aac-tab-scoped-auth:` keys), `src/pages/AdminApprovals.tsx` (replace `detailsAgent` state with `useSearchParams`-derived selection).
- No database, edge function, or RLS changes.
- No changes to `src/integrations/supabase/client.ts` (auto-generated).
