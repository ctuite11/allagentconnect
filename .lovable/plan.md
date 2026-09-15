# Fix: Allison Avramovich shows as "Verified" instead of "Activated"

## What's actually happening

Allison has genuinely activated and signed in:

- Account set up: Sep 14, 18:37 UTC
- Last sign-in: Sep 14, 19:16 UTC
- Last seen: Sep 15, 02:39 UTC
- One listing (220 Dorset Road, currently Off Market)

The admin roster still labels her **Verified** because her sign-in email and her
AAC profile email are different:

- Sign-in (account) email: `aavramovich@gmail.com`
- Profile email shown in Admin: `allison@sumnerrealtyma.com`

The admin roster decides "Activated" by matching accounts to members **by email
address**. Since the two addresses don't match, the system can't see her
sign-in, so she stays at the previous stage.

She is the only member in the whole roster (488 records) whose two addresses
differ, so this affects exactly one row today — but it will silently happen
again for anyone who signs in with a personal address.

## The fix

Match sign-ins to members by their **account identifier** first, and fall back
to email only when there is no identifier match. Nothing else about the
lifecycle rules changes: "Activated" still requires a real sign-in, and the
Pending / Invited / Verified / Ready to sign in / Rejected stages are untouched.

Result: Allison moves to **Activated**, her "Account Activated" date shows,
and the Activated count goes up by one. No other row changes.

## Technical detail

- Function-body-only migration to `admin_auth_user_signin_map`: also return
  `auth.users.id` alongside the existing `email` / `last_sign_in_at`. No table,
  column, RLS, or grant changes.
- `supabase/functions/admin-list-agents/index.ts`: build a second map keyed by
  user id. For profile-derived rows (whose `agent_profiles.id` is the auth user
  id), resolve `last_sign_in_at` and `has_auth_account` from the id map first,
  then fall back to the existing email map. Early-access and
  pending-verification rows keep email matching, since they have no auth id.
- No change to `deriveLifecycleStatus`, `deriveAdminStatus`, the pills, filters,
  counts logic, email columns, or any other function.

## Verification

- Roster total and each lifecycle count before/after: only `verified` −1 and
  `activated` +1.
- Allison's row shows Activated with her activation date.
- Spot-check three members whose emails match — status unchanged.
- No emails sent or queued (`email_jobs` count identical).
- Type-check and production build pass.

Deploy `admin-list-agents` and apply the one function-body migration. Frontend
publish only on your approval.
