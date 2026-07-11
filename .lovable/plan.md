## Problem

Your preview is on `/index`, which isn't a defined route. The app renders the 404 page ("Oops! Page not found"), which on a mobile viewport looks mostly blank above the fold. The auth page itself (`/auth`) loads correctly — I verified it renders the Sign In form with no errors.

So this isn't an auth bug. It's a routing bug: `/index` has no route, and nothing in the codebase links there, so you likely arrived via a stale URL/bookmark.

## Fix

Add a redirect route so `/index` sends users to `/` (the real homepage). This is a one-line change in the router.

### Technical detail
- In `src/App.tsx` (or wherever `<Routes>` is defined), add:
  ```tsx
  <Route path="/index" element={<Navigate to="/" replace />} />
  ```
- No other files change. No auth, DB, or UI changes.

## After the fix
- Visiting `/index` will land on the homepage, and the "Sign In" / login flow is reachable normally at `/auth`.
- If you still can't log in after that, share the exact URL you're on and any error toast — auth itself is functioning in the preview.
