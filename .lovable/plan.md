## Goal

Verify the `send-client-need-notification` edge function now requires a valid authenticated session (dry-run-only `sender_id` fallback was removed) and behaves correctly end-to-end with zero writes. Queue stays paused until this passes.

## Steps

1. **Confirm code state** — re-open `supabase/functions/send-client-need-notification/index.ts` and verify:
   - No `sender_id` field on the request body type.
   - Auth resolution only accepts a validated `Authorization` bearer token.
   - `throw new Error("Unauthorized")` fires whenever `user` is unset, for both `dry_run` and live sends.

2. **Redeploy** the function via `supabase--deploy_edge_functions(["send-client-need-notification"])`.

3. **Negative auth check** — call the function via `supabase--curl_edge_functions` with an explicit `Authorization: Bearer invalid` header and `dry_run: true`. Expect HTTP 500 with `error: "Unauthorized"`. Confirms the fallback is truly gone.

4. **Authenticated smoke test** — call the function with the preview session (no explicit Authorization header, so the preview bearer is auto-injected) using a realistic targeted payload:
   ```json
   {
     "dry_run": true,
     "category": "buyer_need",
     "subject": "Smoke test — targeted MA condo",
     "message": "dry-run smoke",
     "audience_scope": "targeted",
     "criteria": {
       "state": "MA",
       "propertyTypes": ["condo"],
       "minPrice": 500000,
       "maxPrice": 1200000
     }
   }
   ```
   Verify the response contains:
   - `dry_run: true`
   - `audience_scope: "targeted"`
   - `parsed_criteria` reflecting the payload (state, property_types, min/max price)
   - `any_criteria_supplied: true`
   - `activated_verified_audience`, `globally_suppressed`, `self_excluded` consistent with prior runs
   - `final_real_recipients` equals `preferences_matched + preferences_unset_fallback`

5. **Zero-write confirmation** — via `supabase--read_query`, count rows in `comms_broadcasts`, `agent_sent_broadcasts`, and `email_jobs` created within the smoke-test window (last 5 minutes). Expect 0 new rows in all three.

6. **Report** back with:
   - Negative-auth response
   - Full smoke-test response JSON
   - Zero-write row counts
   - Explicit statement that the queue remains paused pending user approval to unpause.

## Not in scope

- No code changes (unless step 1 reveals a regression).
- No UI changes.
- No unpausing the queue.
- No live sends.
