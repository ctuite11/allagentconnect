# Fix "please sign in again" when sending an admin email

## What I confirmed

- The `/admin/send-email` page calls the `admin-send-email` backend function through the shared authenticated caller. That caller turns any 401 response into the message "Please sign in again."
- The function is deployed and reachable: an unauthenticated probe returns `401 {"error":"Unauthorized"}`.
- Its logs for your attempt at 16:42 show only boot/shutdown — no error lines — because the function logs nothing on the rejection path. So we can see it rejected the call, but not why (missing header, token not accepted, or role lookup).
- Admin identity is currently established by building a second client with the public key and asking it who the caller is. Other admin functions use the same pattern, so the likely difference is a token/verification hiccup rather than a missing admin role.

## Plan

1. Add request logging to `admin-send-email`: whether an Authorization header arrived, the token verification outcome (with the underlying error message), the resolved caller email, and the admin-role result. No tokens or secrets logged.
2. Make identity verification resilient: verify the bearer token directly with the service-role client (`auth.getUser(token)`) instead of relying only on a public-key client with a forwarded header. Fall back to the current path if that returns nothing.
3. Return distinct, honest errors so the UI stops mislabelling problems:
   - no/invalid token -> 401 "Session expired, please sign in again"
   - valid user without the admin role -> 403 "Admin access required" (includes the caller's email)
4. Redeploy the function, then have you retry a send while I read the new logs to confirm the exact cause and that it now succeeds.

## Notes

- No email templates change, no queue retries or backfills, no sends triggered by me beyond your own retry.
- Only `supabase/functions/admin-send-email/index.ts` is touched; the page and shared email code stay as-is.
