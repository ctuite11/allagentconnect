## Diagnosis

Morgan (`morgan@westgatecompanies.com`) was deleted, but her `pending_verifications` row is still `status='pending'` — which is why she still appears in the admin approval list.

**Confirmed remnants (all other records gone):**
- `deleted_users`: ca72454f… ✅ (deletion succeeded)
- `pending_verifications`: 7d049a1d… **status still `pending`** ← the leak
- Everything else (`auth.users`, `agent_profiles`, `profiles`, `agent_settings`, `user_roles`, `agent_early_access`): gone

**Why reject didn't work first:**
The reject path at `AdminApprovals.tsx:745-751` does a client-side `supabase.from("pending_verifications").update({ status: "rejected" })`. RLS policy `Admins can update pending verifications` requires `has_role(auth.uid(),'admin')`. If the session token wasn't validating (same class of issue we just fixed on `admin-verify-agent`), the update silently no-ops with 0 rows — no thrown error, no toast failure. That's consistent with "reject didn't work."

**Why delete left the row behind:**
`delete-users` was built for auth-backed accounts (auth.users + related). For a Phase 3 lead whose only record is a `pending_verifications` row, it removes the auth/profile records (all zero of them) and never touches `pending_verifications`. Result: `deleted_users` marker is inserted, but the pending row is orphaned and re-surfaces in the admin list.

## Fix

### 1. One-time cleanup (data)
Mark Morgan's orphaned pending_verifications row as `rejected` so she stops appearing in the pending list. Do not delete the row — `deleted_users` audit already references this email, and keeping `rejected` preserves the historical signal used by `guardDeletedAgent`.

```sql
UPDATE public.pending_verifications
SET status = 'rejected'
WHERE id = '7d049a1d-3a5b-42ab-9765-efcdb7737f22'
  AND status = 'pending';
```

### 2. Make reject robust (frontend)
In `src/pages/AdminApprovals.tsx` reject branch:
- After the `update`, check `data`/rows-affected. If 0 rows updated, throw so the toast shows a real error instead of a silent success.
- Use `.select('id').single()` on the update so a missing row / RLS block surfaces as an error.

### 3. Make delete complete (edge function)
In `supabase/functions/delete-users/index.ts`, after purging auth/profile records, also:
- `UPDATE pending_verifications SET status='rejected' WHERE lower(email)=lower($1) AND status='pending'` for each deleted email.
- Include the count in the response so the admin toast can say "also cleared N pending verification row(s)."

This keeps the audit trail (row stays, marked `rejected`) and prevents future deletions from leaving the same orphan.

### 4. Verify
- Refresh admin approvals — Morgan should be gone.
- Try reject on any remaining pending lead — expect either success toast or a real error, never silent no-op.

## Scope guardrails
- No changes to verification logic, license-verified email, idempotency, or schema.
- No delete-users behavior change beyond the added pending_verifications cleanup step.
- No touching Ryan Shannon or any other row.