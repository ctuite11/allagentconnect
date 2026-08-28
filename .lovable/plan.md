# Speed up Admin → Send Email

Three separate delays are in play: opening the screen, sending, and getting back to Admin.

## 1. Opening the Send Email screen

Today the page waits on three sequential round trips before rendering anything (get user → admin role check → profile lookup), and only then paints the form. The route chunk also downloads on click.

Changes:
- Render the form immediately; resolve the admin/sender identity in the background. The From line keeps its "Resolving…" state, and the Send button stays disabled until the check clears.
- Fetch the role check and the profile row in parallel instead of one after the other, and use the already-cached session rather than a fresh network user fetch.
- Prefetch the Send Email route chunk when the admin hovers/focuses the "Send email" button on the Admin page so the screen is already loaded on click.

## 2. Sending

The click path currently forces a session refresh and waits on it before the request even leaves the browser, then waits for the server to verify the token, check the role, look up the profile, build the HTML and insert the job.

Changes:
- Skip the forced token refresh when the current access token is comfortably valid, so the request fires immediately.
- On the server, run the role check and the sender-profile lookup in parallel (both are keyed to the same user) instead of sequentially.
- No change to how the email is queued or sent: the job is still inserted into the normal queue and the queue is still kicked in the background.

## 3. Returning to Admin

There is no back control on the Send Email screen, so returning means a fresh full load of the Admin Approvals page and all of its data.

Changes:
- Add a "Back to Admin" control that navigates in-app (no reload).
- Keep the Admin page's data in cache briefly so an immediate return renders from cache while refreshing in the background, instead of showing a full loading state again.

## Out of scope

No changes to email templates, the sending queue, sender-identity security rules, or what actually gets delivered. The `@allagentconnect.com` sender enforcement and admin-only gating stay exactly as they are.

## Technical notes

- `src/pages/AdminSendEmail.tsx`: non-blocking auth/identity resolution, parallel `hasRole` + `profiles` fetch, session-based user read, back navigation.
- `src/pages/AdminApprovals.tsx`: prefetch of the lazy route on hover/focus of the Send email button; cached-render on return.
- `src/lib/invokeEdgeFunction.ts`: only refresh when the token is near expiry (keep the existing fallback and 401 handling).
- `supabase/functions/admin-send-email/index.ts`: `Promise.all` the `has_role` RPC and the profile lookup; redeploy. Behaviour and error codes unchanged.
