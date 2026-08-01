## What's happening

The new "Preview License Verified email" button fails with *"Edge Function returned a non-2xx status code."*

Verified from the live logs, not assumed:
- `POST /send-license-verified-preview` → **401**, twice (05:09:09 and 05:08:57 UTC). The `OPTIONS` preflight returned 200, so CORS is fine.
- The function booted on both attempts but logged nothing else. The only paths in it that return without logging are the authentication checks — so it is rejecting the caller, not failing at Resend.

The likely cause is the Supabase client version used for the auth check. The new function pins `@supabase/supabase-js@2.39.3` from esm.sh, while the admin function that works today (`admin-list-agents`) uses the current `@supabase/supabase-js@2`. This project uses the newer signing-keys auth system, where JWT validation should go through `getClaims()`. The new function's older client and `getUser()` call is the one thing that differs from the known-good admin function.

## Fix

1. **Align the preview function's auth with the working admin pattern** — in `supabase/functions/send-license-verified-preview/index.ts`:
   - Use the current Supabase client (`npm:@supabase/supabase-js@2`) instead of the pinned esm.sh 2.39.3 build.
   - Validate the bearer token with `getClaims()`, then confirm the admin role with the existing `has_role` check, exactly as `admin-list-agents` does.
   - Keep the recipient hardcoded to the caller's own email from the verified claims — no client-supplied `to`.
2. **Add distinct log lines and error strings** for each rejection reason (missing header, invalid token, not an admin) so any remaining failure names itself instead of surfacing as a generic 401.
3. **Redeploy and confirm** via the edge-function logs that the call returns 200 and a send is recorded.

## What stays untouched

- `buildLicenseVerifiedEmailHtml.ts` and every other email template — no edits.
- All branding assets — no edits.
- The activation button in the preview stays inert (`#`); no activation token is issued.
- No queue rows, no stream/pause changes, no Hot Sheet or listing behavior. The preview still calls Resend directly.

## Technical detail

Only two files are involved: the preview edge function (auth block rewritten, everything below it unchanged) and no frontend change — `AdminApprovals.tsx` already surfaces the returned error text correctly, which is how the 401 became visible in the first place.
