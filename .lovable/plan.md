# Truthful agent lifecycle: Invited / Ready to sign in / Activated

## Verified current state

- `agent_settings` has `account_activated_at` and `verified_at`; there is no `credentials_issued_at` column anywhere in the schema or code today.
- Lifecycle is derived in two places with identical rules that check `account_activated_at` first: `src/pages/AdminApprovals.tsx` (`deriveAdminStatus`) and `supabase/functions/admin-list-agents/index.ts` (`deriveLifecycleStatus`). Neither uses `last_sign_in_at`, though the function already returns it per agent.
- `supabase/functions/admin-set-user-password/index.ts` sets the password, confirms the email, then calls `mark_agent_activated` — that RPC is what stamped Irina.
- `mark_agent_activated` is also called by the real owner paths: `src/pages/AgentAccountSetup.tsx` and `src/pages/PasswordReset.tsx`.
- `AgentDetailsDrawer.tsx` renders a fixed "Account Activated" row from `account_activated_at`.

Scope of the bad data (queried against all 502 agent accounts):

- signed in at least once: 302
- activation stamp but never signed in: **1** (Irina, `irina@irinaspiegel.com`, stamped 2026-09-02 18:09:14 UTC, email confirmed the same second, `last_sign_in_at` null)
- no stamp, never signed in: 199

So the correction touches exactly one row.

## Changes

1. **Schema**: add `credentials_issued_at timestamptz` to `agent_settings`, plus a `mark_agent_credentials_issued(_user_id)` security-definer RPC (idempotent, agent-scoped, same shape as `mark_agent_activated`).

2. **Admin set-password function**: replace the `mark_agent_activated` call with `mark_agent_credentials_issued`. Password setting and `email_confirm: true` stay exactly as they are. No email is sent.

3. **Real activation**: keep `mark_agent_activated` on the owner setup and password-reset paths, and add a one-time call after a successful first sign-in so the stamp always has a real sign-in behind it. Display never trusts the stamp alone.

4. **One-time data correction** (single row, Irina, and any row matching the same signature at run time): set `credentials_issued_at` to the existing `account_activated_at` value and clear `account_activated_at`, scoped to rows where the stamp exists and `auth.users.last_sign_in_at` is null. Passwords, identities, verification status, and every signed-in account are untouched.

5. **Identical derivation in both places** (`AdminApprovals.tsx` and `admin-list-agents/index.ts`):
   - `last_sign_in_at` present → Activated
   - else `credentials_issued_at` present → Ready to sign in
   - else verified/invited/pending/rejected as today

6. **Admin UI**: add the "Ready to sign in" state to lifecycle counts, filter pills, the status filter dropdown, and roster labels. `AgentDetailsDrawer.tsx` shows a "Credentials Issued" row when applicable and only shows "Account Activated" for accounts that have actually signed in.

## Reporting before deploy

After the migration runs I will report Invited / Ready to sign in / Activated counts before and after. Expected from current data: Activated drops from the stamp-based figure to 302 (sign-in backed), Ready to sign in becomes 1 (Irina), the rest unchanged.

## Guardrails honored

No emails, no password resets, no auth recreation, no verified-status changes, nothing outside this lifecycle correction. Irina's password stays valid; she shows "Ready to sign in" until her first sign-in, then flips to "Activated" automatically.
