## Problem

"Please sign in again" toast on My Clients → Send Email (Custom).

The user's session is valid (auth `/user` calls return 200). But the `send-agent-client-email` edge function logs only show `booted` — no `[send-agent-client-email] authenticated` line — meaning the request never reached the function body. The Supabase gateway rejected it with 401 first.

Why: in `supabase/config.toml`, every email-related function that takes a Bearer token (e.g. `send-buyer-agent-email`) is explicitly declared with `verify_jwt = false` so the function can validate the token itself via `supabase.auth.getUser()`. The newly added `send-agent-client-email` is missing from `config.toml`, so it inherits gateway JWT verification, which fails on the SDK's Authorization header and returns 401 before invoking.

The client (`invokeEdgeFunction` → `friendlyEdgeFunctionMessage`) maps any 401 to "Please sign in again."

## Fix

Add this block to `supabase/config.toml` (next to the other `send-*-email` entries):

```toml
[functions.send-agent-client-email]
verify_jwt = false
```

The function already authenticates the caller in code (`supaUser.auth.getUser()` at line 37), so disabling gateway verification is correct and matches the existing pattern.

## Verification

1. Redeploy `send-agent-client-email` (config changes require it).
2. User retries Custom message send.
3. Pull function logs — should now show `[send-agent-client-email] authenticated`.
4. Confirm new row in `email_jobs` with `template: agent-client-email`.

## Not changing

- No DB / migrations.
- `BULK_EMAIL_PAUSED=true` stays.
- `send-bulk-email` config unchanged (it's intentionally paused).
- No frontend changes.
