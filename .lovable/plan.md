# Make the admin agent list load fast

## Where the 5 seconds actually go

Measured from the live function logs for the most recent load (boot 02:10:56 → done 02:11:01) plus a direct database timing:

```text
verify caller (getUser, then has_role)   ~1.0s
scan auth users (421)                    ~1.0s
agent_profiles (401)                      ~0.5s
agent_settings (401, 3 chunks in series)  ~1.0s
early access + pending verifications      ~1.0s
email_jobs merge + serialize              ~0.5s
```

The email-jobs query is no longer the problem — it now uses the template index and runs in **150ms** at the database. What remains is that the work is still largely **serial**: caller verification is two round trips one after the other, the `agent_settings` lookup runs its 200-row chunks one at a time, and the auth-user scan blocks everything behind it. On top of that the client cache lives only in memory, so a browser reload always pays the full cold cost with a spinner.

## Fix

**1. Verify the caller in one step**
Resolve the user and the admin role check concurrently instead of `getUser()` → `has_role()` in series. Admin-only enforcement is unchanged and still fail-closed — nothing is returned before the role check resolves.

**2. Start the data reads immediately**
Kick off the profile/settings/early-access/pending-verification/email-jobs reads as soon as the request begins, and only release the response after the admin check has passed. Same authorization guarantee, one fewer serial hop.

**3. Parallelize the agent_settings chunks**
The 200-id chunk loop currently awaits each chunk. Run all chunks with `Promise.all` and keep the existing hard-error-on-chunk-failure behavior (no silent "unknown" statuses).

**4. Replace the auth.users page scan with a targeted read**
Add a read-only `SECURITY DEFINER` function that returns `lower(email)` and `last_sign_in_at` for auth users, so the function gets the same map in one query instead of a paged admin API scan. Granted to `service_role` only. No writes, no triggers, no auth-schema changes.

**5. Make repeat loads instant**
Persist the existing 5-minute admin list cache to `sessionStorage` in addition to memory, so a reload or a return from another page renders the last list immediately and revalidates in the background. Full-page spinner only when there is genuinely no cached data.

Expected: first load roughly 1–1.5s instead of ~5s, and repeat visits/reloads paint instantly.

## Technical notes

- Files: `supabase/functions/admin-list-agents/index.ts`, one new migration for the auth-lookup function, and `src/pages/AdminApprovals.tsx` for the cache persistence.
- Output shape of `admin-list-agents` is unchanged — lifecycle derivation, sorting, email-status merge, and the explicit `pendingVerificationsError` surface all stay exactly as they are.
- Redeploy only `admin-list-agents`.

## Scope guard

No agent records edited, no verifications, no activations, no setup links, no emails, no queue writes. The only database change is one read-only lookup function.
