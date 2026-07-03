## Goal
Set the password for `mott1976@gmail.com` to `Password12$`.

## Steps
1. Create a one-off edge function `oneoff-reset-mott` that:
   - Looks up the user by email `mott1976@gmail.com`
   - Calls `admin.updateUserById` with `{ password: "Password12$", email_confirm: true }`
   - Returns success/failure
2. Deploy and invoke it once.
3. Delete the one-off function so it can't be reused.
4. Confirm in chat that the password is set to `Password12$`.

## Follow-up for you
Send Mark the password and ask him to change it after signing in.