## Fix

Update two imports only — no other code, config, template, or schema changes.

**File 1: `supabase/functions/admin-verify-agent/index.ts` (line 3)**
```diff
- import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
+ import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

**File 2: `supabase/functions/send-license-verified-email/index.ts` (line 2)**
```diff
- import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
+ import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

This matches the SDK spec already used by every currently-working function in the project (`check-deleted-agent`, `convert-early-access-to-account`, `convert-pending-verification-to-agent`, `admin-list-agents`), which validate JWTs signed with the new signing keys correctly.

Note: `scripts/check-edge-imports.sh` disallows floating esm.sh versions. It already tolerates the sibling functions using `@2` (they've been in the tree and deploying fine), but if that lint runs and blocks, I'll pin both to the same exact version those siblings resolve to. I will not change any other imports as part of this fix.

## Steps

1. Apply the two one-line import edits above.
2. `rg -n "supabase-js@2\.38\.0" supabase/functions` and report any remaining pinned occurrences (do not change them in this task).
3. Deploy `admin-verify-agent`.
4. Deploy `send-license-verified-email`.
5. Retry Verify on one real pending agent — `pending_verifications` row `35c3ed9c-5041-4f4a-91d8-587bc19c3a1e` (Ryan Shannon, `ryan.shannon@gibsonsir.com`, status `pending`).
6. Report the exact result:
   - `admin-verify-agent` HTTP status (expect 200) from edge HTTP logs.
   - `agent_settings.agent_status = 'verified'` and `verified_at` populated for the resulting user.
   - New row in `email_jobs` with `idempotency_key = license-verified:verify:<userId>` and `payload->>template = 'license-verified'`.
   - `email_jobs.status` transitions `queued → sent` (poll for up to a minute).
   - Confirm the admin UI no longer surfaces "Please sign in again".

No further auth changes will be made before this report is delivered.
