# Fix the post-login session loop

## Confirmed diagnosis

- The live auth logs show the password login succeeds and the account endpoint returns successfully; this is not a bad-password or hosted-backend outage.
- Password login sends the user to `/dashboard` immediately after receiving a valid session.
- `AuthRoleProvider` stores the newly signed-in user and then resolves the role asynchronously, but it does not mark that role lookup as loading.
- During that brief state (`user` exists, `role` is still `null`, `loading` is false), `/dashboard` currently routes to `/auth`. That creates the observed cycle: **Checking your session → login form → successful login → Checking your session → login form**.

## Implementation

1. Update the shared auth provider so a signed-in user's role resolution has an explicit pending state and stale role values are cleared during account changes.
2. Make `/dashboard` wait whenever an authenticated user exists but their role has not resolved, matching the defensive behavior already used elsewhere in the app.
3. Keep the existing deterministic destinations unchanged:
   - admin → Admin Approvals
   - verified agent/delegate → Agent Dashboard
   - buyer → Client Dashboard
   - unknown authenticated account → Access Error rather than falsely returning to login
4. Add focused regression tests for:
   - successful sign-in while role resolution is pending
   - admin/agent/buyer destination after resolution
   - genuinely signed-out users still returning to login
   - unknown authenticated users not entering an auth loop
5. Verify the full mobile-sized flow in the running app: submit credentials, observe one loading transition, and confirm the authenticated destination remains stable without returning to `/auth`.

## Scope

- Frontend auth/session state and routing only.
- No account, password, role, database, or auth-configuration changes.
