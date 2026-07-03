## Fix Chrissy — controlled admin password reset

No bypass secret. Uses the existing `admin-set-user-password` edge function with your admin session.

### What I need from you before I run anything
1. Sign in to the preview at `/auth` as your admin account (chris@…). Reply "signed in".
2. Give me the temporary password to set for her.

### What I will do, in order
1. **Delete** the leftover `ADMIN_SETUP_BYPASS_SECRET` so no bypass path exists. (This is a deletion, not a creation.)
2. Verify the current `admin-set-user-password` function:
   - Requires admin caller (`has_role` check).
   - Does not log the password value.
   - Does not send any email.
3. Ensure `supabase/config.toml` has `verify_jwt = true` for this function so only your real admin session is accepted.
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
8. Confirm to you: done.

### After the reset (your handoff to Chrissy)
- URL: `https://allagentconnect.com/auth`
- Email: `chrissy@southshoresir.com`
- Temporary password: (the value you gave me)
- **Immediately after logging in, change her password** in Settings.

### Guarantees
- Password value is never logged, echoed, or emailed by the system.
- No temporary bypass secret exists after step 1.
- No downgrade of `agent_status` (verified stays verified).

Approve and, once you've signed in and given me the temp password, I'll execute.
