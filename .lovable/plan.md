## Set Chrissy's password directly (bypass the broken activation link)

Chrissy exists, is `verified`, but `account_activated_at` is null — the recovery link flow is failing her. I'll set her password server-side using admin credentials.

### Steps
1. Add a small admin-gated edge function `admin-set-user-password` that:
   - Requires the caller to be an admin (`has_role`).
   - Looks up the user by email.
   - Calls `auth.admin.updateUserById` with `{ password, email_confirm: true }`.
   - Writes `account_activated_at = now()` if unset; flips `invited → verified` (never downgrades).
2. Deploy it.
3. Invoke it once for `chrissy@southshoresir.com` with password `Pasword16$`.
4. Verify she can sign in at `/auth`.

### Files
- New: `supabase/functions/admin-set-user-password/index.ts`

### After it works
Send her:
- URL: https://allagentconnect.com/auth
- Email: chrissy@southshoresir.com
- Password: Pasword16$ (advise her to change it after login under Settings)

Approve and I'll execute it.