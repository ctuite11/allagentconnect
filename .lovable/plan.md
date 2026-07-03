## Set password for Mark Ott (same pattern as previous two)

**Target user**
- Email: `mark.ott@cbrealty.com`
- Auth UUID: `30d733db-f00f-4909-b188-3fd589a1010c`

**Steps**
1. You click the secure secret form and enter the password you want Mark to have (stored as `MARK_OTT_TEMP_PASSWORD` — never appears in code or chat).
2. Run a one-off admin script (edge function) that calls `supabase.auth.admin.updateUserById(...)` to set his password to that value and confirms his email if not already confirmed.
3. Verify with a quick `auth.users` check that `updated_at` moved and email is confirmed.
4. Delete the temp secret so it isn't left in the environment.
5. You send the password to Mark yourself in your own channel.

Once you approve, switch to build mode and I'll prompt you for the password value.