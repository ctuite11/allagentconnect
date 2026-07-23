## Problem

On mobile, clicking Next/Prev on the Agent Network (`/our-agents`) keeps the scroll position at the bottom (near the pager), so the new page appears to start mid-list. Route pathname does not change on pagination, so `ScrollRestoration` does not fire.

## Fix

In `src/pages/OurAgents.tsx`, add an effect that scrolls to the top whenever `page` changes:

- Reset `window.scrollTo(0, 0)` and also reset any `[data-app-scroll-root]` container's `scrollTop` (agent-authenticated shell scrolls inside AppShell, public visitors scroll the window) — mirrors the logic already used in `ScrollRestoration.tsx`.
- Trigger only on `page` change (not initial mount alongside pathname reset, which already handles first load).

No other changes; pagination logic, filters, and layout stay identical.
