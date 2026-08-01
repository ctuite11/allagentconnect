## What the database says

Read-only query against `auth.users` + `agent_settings` + `agent_activation_tokens` + `deleted_users`, filtering for `agent_status IN ('verified','invited')` AND `account_activated_at IS NULL`.

Result: **24+ accounts qualify on the three data gates** (verified, activation NULL, zero live tokens, zero tombstones). But almost all of them are **real, third-party agents** — `scott.farrell@compass.com`, `louis@serhant.com`, `deborah.lucci@raveis.com`, etc. Issuing to any of them sends a real activation email to a real person as a side effect of a test. That is not an acceptable test target.

The two non-real candidates:

| Account | Gates | Usable? |
|---|---|---|
| `e2e.verified.agent@allagentconnect.test` | passes all data gates, no agent profile | No — `.test` is a reserved non-routable TLD, so the delivery gate can never be satisfied |
| `doittuite15@yahoo.com` | passes all data gates (tombstone already removed) | Yes on data, but you just declined it |

So there is no existing account that is both admin-controlled and capable of receiving mail.

## Recommended path

Create one purpose-built test account on an inbox you own, then run the single authorized issuance against it.

```text
chris+phase3@allagentconnect.com
  -> real inbox (plus-addressing delivers to chris@allagentconnect.com)
  -> brand-new row, so account_activated_at is NULL by construction
  -> no deleted_users tombstone, no live token
  -> disposable: purging it afterwards touches no real agent
```

### Steps

1. **Create the account** through the normal admin path — submit it as a pending verification, then approve it in Admin Approvals. No hand-written SQL against `auth.users`; the account is created the same way a real agent's is, so the test exercises the real code path.
2. **Confirm pre-state** with one read-only query: `agent_status = 'verified'`, `account_activated_at IS NULL`, zero rows in `agent_activation_tokens`, zero rows in `deleted_users`, zero pending `email_jobs` for that address.
3. **Single issuance** — you click "Send verification/activation email" exactly once from Admin Approvals while signed in as admin. The service-role boundary rejects any call I make directly, so the click has to come from you.
4. **Verify issuance** — exactly one `agent_activation_tokens` row, status `issued`, `expires_at` ≈ now + 7 days, hash-only storage with no plaintext anywhere in the row or the job payload.
5. **Verify delivery** — one `email_jobs` row on the transactional stream, moving to sent; you confirm arrival in the inbox.
6. **Verify redemption** — click the link once. Expect: token flips `issued -> redeeming -> redeemed`, a fresh short-lived auth link is minted, the agent lands signed in, and `account_activated_at` gets stamped. Then confirm a second click on the same link is refused as already-used.

### Guardrails carried forward

- Exactly one issuance. If it returns `ineligible` or `already_live`, that is the test result — not permission to retry.
- No resend, no retry, no re-enqueue, no backfill without separate explicit approval.
- No email template, wording, branding, or footer changes.
- Hot Sheet stream stays paused; nothing about the emergency pause flags changes.
- No issuance to any of the 24 real third-party agents in the qualifying list.

## If you'd rather not create an account

The only other route is authorizing `doittuite15@yahoo.com` after all — its tombstone is already removed and it passes every data gate today. Say the word and I'll write the plan against that instead.
