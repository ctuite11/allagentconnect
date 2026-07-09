## Problem

Navigating between agent profile pages (and other authenticated pages) leaves the new page scrolled to where the previous page was. `window.scrollTo(0, 0)` in `ScrollRestoration` has no effect because the actual scroll container is `AppShell`'s inner `overflow-y-auto` div, not the window.

## Fix

1. **Tag the AppShell scroll container** in `src/components/layout/AppShell.tsx` with a stable hook, e.g. `data-app-scroll-root` on the existing `<div class="flex-1 ... overflow-y-auto ...">`.

2. **Update `src/components/ScrollRestoration.tsx`** so that on every `location.pathname` change it resets scroll on both surfaces:
   - `window.scrollTo(0, 0)` (public pages / footer-based layouts)
   - Every element matching `[data-app-scroll-root]` → `el.scrollTop = 0` (agent AppShell pages)
   - Also reset `document.documentElement.scrollTop` / `document.body.scrollTop` as a safety net.

No other behavior changes. Existing `ScrollToTop` floating button stays as-is.

## Verification

- Navigate agent → agent profile → back → another agent: each load starts at top.
- Verify public (`/agent/:id` while signed out) still lands at top.
- Verify long buyer/search pages continue to scroll normally after the reset.
