## Activation tokens — approved design, branch implementation only

Production migrations applied: NO · Production functions deployed: NO · Secrets created: NO · Production jobs enqueued: 0 · Emails sent: 0

### 1. Pre-generated record ID
Edge function creates `activation_token_id = crypto.randomUUID()` before hashing. The issuance RPC takes `p_id` and inserts exactly that ID. Token, stored digest, queue payload, and idempotency key all reference it.

### 2. Canonical HMAC input
Signed bytes: `v1|<id>|<user_id>|<expires_at_epoch_seconds>` — integer epoch, never an ISO string. Stored `expires_at = to_timestamp(epoch)` truncated to whole seconds, so the round-trip is lossless. Deno tests with fixed vectors prove issuer, redeemer, and a Postgres `hmac()` reference emit identical bytes.

### 3. Idempotent initial issuance
`agent_activation_tokens.issuance_key text not null unique`. The initial email derives it server-side from the immutable approval event: `license-verified:<user_id>:<verified_at_epoch_seconds>`. Callers cannot supply or influence it. A repeat request returns the existing token ID and job ID — no new token, no revocation, no second job. Explicit expired-link resend uses a distinct key (`resend:<user_id>:<handle_id>`) and may revoke the prior `issued` token.

### 4. Atomic issuance RPC
`public.issue_agent_activation_token(...)`, service-role only, security definer, single transaction under `pg_advisory_xact_lock` keyed on the user:

1. If `issuance_key` exists → return `{token_id, job_id, deduped:true}`.
2. Reclaim only that user's stale `redeeming` row (>5 min); return `blocked` if a live one remains.
3. Revoke prior `issued` rows (resend keys only).
4. Insert the token row with `p_id`.
5. Insert the `email_jobs` row.
6. Return both IDs.

Failure leaves neither row. **The RPC constructs the job payload itself** from validated scalar parameters (`p_user_id`, resolved `p_to_email`, `p_subject`, `p_reply_to`) — it never inserts caller-supplied JSON. Any extra caller keys are dropped; `stream` is forced to `'transactional'`, `template` to `'license-verified'`, and `idempotency_key` to `'license-verified/<p_id>'`. Recipient is re-verified inside the RPC against the bound user's auth email. The partial unique index on active `user_id` remains a final constraint only.

### 5. Atomic resend (required invariant)
One service-role-only RPC, `redeem_resend_handle_and_issue(...)`, in a single transaction:

1. `SELECT ... FOR UPDATE` the handle row by hash: must be unused, unexpired, `purpose='activation_resend'`.
2. Acquire the per-user advisory lock.
3. Create the replacement activation token.
4. Insert the transactional email job.
5. Mark the handle used.
6. Commit together.

If any step fails the transaction rolls back: the handle stays **unused**, and no token or job remains. A resend attempt is never burned by a transient database failure.

### 6. Resend handle and cookie
`/activate` reads the token from `location.hash`, strips it with `replaceState`, and submits a real same-origin form POST. On failure the server mints an opaque handle and 303s to `/activate?state=failed|expired|in_progress`.

Cookie: `HttpOnly; Secure; SameSite=Strict; Max-Age=900; Path=/` so it reaches `/api/resend-activation-link`. The handle record stores only a hash, is bound to one token record and user, expires in 15 minutes, is single-use, and is consumed only inside the transaction above. The cookie is cleared after successful use or terminal failure. The endpoint requires a same-origin POST and validates `Origin`. The handle cannot redeem an account. The activation token never enters a query string, `Location`, a cookie, storage, or logs.

### 7. Provider idempotency in the real sender
`_shared/sendEmail.ts` accepts `providerIdempotencyKey` and sends it as a true HTTP header `Idempotency-Key: license-verified/<id>` on the Resend request — not in the email headers object. For this template the token is reconstructed and HTML rendered in-memory immediately before the call, deterministically from the record, so `from`, `to`, `subject`, `html`, `text`, `reply_to`, and `headers` are byte-identical across retries (the marketing tracking/pixel/unsub path never runs). Retries capped at 6 attempts / 12 hours, under Resend's 24-hour retention; past that the job is terminal and recovery is a new issuance key.

### 8. Issuance bound to the approved user
`send-license-verified-email` accepts only `{ user_id }`; `to`, `ctaUrl`, `subject`, `html` are rejected. Caller must be an AAC admin (`has_role`) or an internal service call. `agent_is_activation_eligible` requires verified + not yet activated, `auth.users.deleted_at IS NULL`, `banned_until IS NULL OR banned_until <= now()`, no `deleted_users` match, and the **latest** `pending_verifications` record not rejected. Rate limits store an HMAC of the IP — no raw IP.

### 9. Storage and redemption
`public.agent_activation_tokens`: caller-supplied `id`, `user_id`, `token_hash`, `expires_at`, `issuance_key` (unique), status `issued|redeeming|redeemed|revoked`, timestamps. RLS on, privileges revoked from anon/authenticated, service_role only, no plaintext persisted. Redemption verifies the HMAC, makes an atomic single-winner claim, re-checks eligibility, generates a fresh Supabase recovery link server-side to `/auth/callback?type=recovery&setup=1`, marks redeemed, and 303s. Failure releases the token. All security-definer functions pin `search_path` and grant execute to `service_role` only.

### Deliverables produced on the branch
Migration SQL, complete diff, Deno tests (HMAC vectors, duplicate issuance, concurrent issuance, resend rollback, single-use handle, cross-origin rejection), rendered `/activate` screenshot, rendered activation email HTML, privilege audit of every new function/table, and a verification matrix. No deploy, no test-send, no production migration without separate explicit approval.

### Files
New: activation-tokens migration; `_shared/activationTokens.ts` (+ tests); `redeem-activation-token`; `resend-activation-link`; `netlify/functions/activate-redeem.ts`; `src/pages/ActivateAccount.tsx` + routes.
Edited: `_shared/sendEmail.ts`, `send-license-verified-email`, `process-email-queue`, `kick-email-queue`, `_shared/buildLicenseVerifiedEmailHtml.ts`, `netlify.toml`.
Unchanged: `generate-agent-setup-link`.

### Report
```
Resend handle consumed before token+job commit: NO
Resend rollback leaves handle unused: YES
RPC inserts caller-supplied JSON payload: NO
Duplicate initial request creates another token/job: NO
Token and queue job created atomically: YES
Resend cookie reaches its POST endpoint: YES
Cross-origin resend accepted: NO
Production migrations applied: NO
Production functions deployed: NO
Secrets created: NO
Production jobs enqueued: 0
Emails sent: 0
```
