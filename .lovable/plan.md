## Scope

Single-file change: `src/pages/AdminApprovals.tsx` only.

## What the file currently does

`invokeAdminVerify()` already:
- Force-refreshes the session (refreshes when access token missing or within 60s of expiry)
- Sends `Authorization: Bearer <current_access_token>` and `apikey: <publishable/anon key>` explicitly via `fetch`
- Parses response JSON and throws on non-2xx or `success: false`
- Attaches `code` and `match` to the thrown Error so the caller can handle the 409 `previously_deleted` flow

So the runtime behavior you want is already in place. The requested change is to route this through the shared `invokeEdgeFunction("admin-verify-agent", body)` helper in `src/lib/invokeEdgeFunction.ts`, which uses the identical refresh + explicit-header pattern. This aligns the code path with every other admin call and removes the duplicate implementation.

## Change

1. Import `invokeEdgeFunction` (in addition to `resolveEdgeFunctionErrorMessage`) from `@/lib/invokeEdgeFunction`.
2. Rewrite the body of `invokeAdminVerify()` to:
   ```ts
   try {
     return await invokeEdgeFunction<AdminVerifyResult>("admin-verify-agent", body);
   } catch (err) {
     // Preserve 409 previously_deleted acknowledge flow used by the caller.
     // invokeEdgeFunction throws Error(message); re-attach code/match from
     // the last known payload if the helper preserved it, otherwise rethrow.
     throw err;
   }
   ```
3. To preserve the `code`/`match` metadata on the thrown error (used by the "Previously Deleted Agent" dialog), extend `invokeEdgeFunction` in `src/lib/invokeEdgeFunction.ts` in a minimal, backwards-compatible way: when throwing, attach `code` and `match` (if present) from the parsed payload onto the Error via `Object.assign`. No other helper behavior changes.

Nothing else in the file or repo changes.

## Explicitly NOT changed

- Ryan Shannon's data
- `supabase/functions/admin-verify-agent/*`
- `convert-pending-verification-to-agent`
- `convert-early-access-to-account`
- `send-license-verified-email`
- Database state
- Verification ordering or idempotency logic
- `AdminApprovals.tsx` UI, filters, or any handler other than `invokeAdminVerify`

## After apply

You will need to **Publish** so the frontend actually ships (edge functions deploy automatically; the React bundle does not). Then click Verify on Ryan.

## Validation I will run after your click

1. Live edge request headers include `Authorization: Bearer …` and `apikey: …` (not just `x-client-info: supabase-js-web`).
2. `admin-verify-agent` passes the missing-header check.
3. `getUser()` result — success confirmed, or precise new 401 body if it becomes B.
4. `has_role(admin)` result — success confirmed, or precise new 403 body if it becomes C.
5. Ryan's `pending_verifications` row moves to processed, `auth.users` row exists, `agent_settings.agent_status = 'verified'`, and exactly one `email_jobs` row with idempotency key `license-verified:verify:<ryan-user-id>`.