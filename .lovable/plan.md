## Set temp password for Alan Nguyen

1. Generate a strong random password (16 chars, mixed case + digits + symbol) meeting the app's password policy.
2. Call the `admin-set-user-password` edge function with `email: alannguyen978@gmail.com` and the new password (runs under your admin session).
3. On success, hand you the credentials to send Alan:
   - Login: `alannguyen978@gmail.com`
   - Password: (shown once here)
   - URL: https://allagentconnect.com
4. He can rotate it under Settings → Password after login.

No code or schema changes.