## Controlled admin password reset — Grace Pettengill

Same flow as Chrissy. No bypass secret, no email sent, password never logged.

### What I need from you before running
1. Sign in to the preview at `/auth` as your admin account (chris@…). Reply "signed in".
2. Confirm Grace's email on file (I'll look it up if you want — reply "look it up" and I'll query `agent_settings` / `auth.users` for a Grace Pettengill match and confirm the exact address before touching anything).
3. Give me the temporary password to set for her.

### What I will do, in order
1. Confirm no `ADMIN_SETUP_BYPASS_SECRET` exists (was removed during Chrissy's reset — verify it's still gone).
2. Re-verify `admin-set-user-password` edge function:
   - Requires admin caller (`has_role` check)
   - Does not log the password value
   - Does not send any email
   - `verify_jwt = true` in `supabase/config.toml`
3. Invoke it once via `supabase--curl_edge_functions` with your admin token:
   - `email`: Grace's confirmed address
   - `password`: the value you provide
4. The function will:
   - `auth.admin.updateUserById` → set password, `email_confirm: true`
   - `agent_settings.account_activated_at = now()` if null
   - `agent_settings.agent_status = 'verified'` if currently `invited` (no downgrade if already verified)
5. Verify via `supabase--read_query`:
   - `account_activated_at IS NOT NULL`
   - `agent_status = 'verified'`
6. Confirm done.

### Your handoff to Grace
- URL: `https://allagentconnect.com/auth`
- Email: (confirmed above)
- Temporary password: (the value you gave me)
- Tell her to change her password in Settings immediately after logging in.

### Guarantees
- Password value never logged, echoed, or emailed.
- No bypass secret exists.
- No downgrade of `agent_status`.

Approve, sign in, confirm her email, and send the temp password — then I'll execute.