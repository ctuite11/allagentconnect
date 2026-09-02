# Fix the misleading agent lifecycle status for admin-set-password accounts

## What the data shows (verified)

For Irina (`irina@irinaspiegel.com`), the single account record shows:

- verified, with `account_activated_at` and `verified_at` both stamped today at 2:09 PM ET
- email confirmed at the same moment
- never signed in (`last_sign_in_at` is empty)
- no duplicate lead or pending-verification record anywhere

The admin list derives lifecycle status by checking `account_activated_at` first, so this account resolves to **Activated**, not **Invited**. If your screen still says Invited, that view was loaded before 2:09 PM ET and simply needs a refresh — there is no stored cache layer behind it anymore.

The real issue is what the stamp means: the timestamp was written by the admin "set temporary password" action, not by Irina completing setup or signing in. So the roster now claims an account is Activated when the agent has never logged in.

## What to change

1. Stop the admin set-password/confirm path from stamping activation. Activation should only be recorded when the account owner actually completes setup or signs in for the first time.
2. Add a distinct display state for "credentials issued, not yet signed in" so the roster tells the truth:
   - Invited: invited, no credentials used
   - Ready to sign in: password/setup link issued, email confirmed, never signed in
   - Activated: has signed in at least once
3. Base the Activated determination on first sign-in rather than on the stamp alone, so historical rows with an admin-written stamp but no sign-in fall into the new middle state instead of appearing fully activated.
4. Correct the existing rows that were stamped by the admin password tool and have never signed in (identified by a stamp that matches the admin action with no sign-in), so counts and filters reflect reality.
5. Refresh the lifecycle counts, filter pills, and the agent details drawer to include the new state.

No emails are sent, no accounts are reset, and Irina's password stays valid — she can still sign in with the details already delivered.

## Technical notes

- Status derivation lives in both `src/pages/AdminApprovals.tsx` and `supabase/functions/admin-list-agents/index.ts`; both must derive identically, using `last_sign_in_at` (already returned by the function) alongside `account_activated_at`.
- The stamping change is in the admin set-password Edge Function path; the activation write there is removed while email confirmation stays.
- Row correction is a one-time data migration limited to `agent_settings` rows with an activation stamp and no auth sign-in.
- `AgentDetailsDrawer.tsx` shows an "Account Activated" row that needs the same three-state treatment.
