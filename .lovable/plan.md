## Fix Chrissy — controlled admin password reset

No bypass secret. Uses the existing `admin-set-user-password` edge function with your admin session.

### What I need from you before I run anything
1. Sign in to the preview at `/auth` as your admin account (chris@…). Reply "signed in".
2. Give me the temporary password to set for her (e.g. `Pasword16$` or a new one you pick).

### What I will do, in order
1. Confirm `ADMIN_SETUP_BYPASS_SECRET` does not exist; delete it if it does.
2. Verify the current `admin-set-user-password` function:
   - Requires admin caller (`has_role` check).
   - Does not log the password value.
   - Does not send any email.
3. Ensure `supabase/config.toml` has `verify_jwt = true` for this function so only your real admin session is accepted (no anon/bypass path).
4. Redeploy the function.
5. Invoke it once via `supabase--curl_edge_functions` with your admin token:
   - `email`: `chrissy@southshoresir.com`
   - `password`: the value you provide
6. The function will:
   - `auth.admin.updateUserById` → set password, `email_confirm: true`
   - `agent_settings.account_activated_at = now()` if null
   - `agent_settings.agent_status = 'verified'` if currently `invited`
7. Verify via `supabase--read_query`:
   - `account_activated_at IS NOT NULL`
   - `agent_status = 'verified'`
   - Return `{ success: true, userId }` observed
8. Confirm to you: done. You then send Chrissy her login details out-of-band and tell her to change her password on first login.

### Guarantees
- Password value is never logged, echoed, or emailed by the system.
- No temporary bypass secret is created.
- No downgrade of `agent_status` (verified stays verified).
- Only the single admin function call and the two safe DB updates it performs — nothing else touched.

Approve and, once you've signed in and given me the temp password, I'll execute.
