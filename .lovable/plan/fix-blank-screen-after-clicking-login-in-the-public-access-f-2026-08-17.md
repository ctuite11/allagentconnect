# Fix blank screen after clicking "Login" in the public access flow

## Confirmed diagnosis

Verified against the live site (allagentconnect.com) and the running preview:

- A direct/hard request to `https://allagentconnect.com/login` returns **301 → /auth**. That redirect comes from a legacy line in `public/_redirects`: `/login /auth 301!`, which predates the new `/login` chooser page.
- On that forced `/auth` load the browser then fails: `Failed to fetch dynamically imported module: /assets/Auth-B-bHlSro.js` (server returns 500 for the chunk). The router has nothing to render, so the page paints **blank**.
- Client-side clicks (React Router links, no full page load) do reach `/login` and render the chooser correctly — which is why the bug only appears on hard loads, new tabs, and refreshes.
- The route itself is fine: `/login` → `LoginPage` is registered in `src/App.tsx` (line 429) and renders the Agent / Developer chooser in preview.
- `/request-access`, `/developer-access`, `/developer-login`, `/auth` all render normally on both preview and production when loaded directly.

Note: the "Already have an account? Login" link on `/developer-access` currently reads "Already have Developer access? Developer Login" and points to `/developer-login`; the `/login` chooser link is on `/request-access`. Both paths funnel through the same broken `/login` hard-load behavior.

## The fix (one file)

`public/_redirects`:

- Remove the legacy `/login /auth 301!` line so `/login` falls through to the SPA and renders the chooser.
- Repoint the legacy alias `/log-in` to `/login` (instead of `/auth`) so it lands on the chooser too.
- Leave `/signup`, `/sign-up`, and every other rule untouched.

Result: `/developer-access` or `/request-access` → click Login → `/login` chooser → Agent goes to `/auth`, Developer goes to `/developer-login`.

## Verification

1. `tsgo` typecheck and production build.
2. Run existing route/auth unit tests.
3. Browser pass on the preview: load `/login`, `/request-access`, `/developer-access`, `/developer-login`, `/auth` directly, confirm each renders with no console/runtime errors, and walk the Request Access → Developer → Login click path.
4. Re-check the redirect behavior after publish (`curl -I /login` should return 200, not 301).

## Out of scope

No changes to auth logic, role resolution, backend, Developer portal, agent onboarding, or page design. No new components or routes.
