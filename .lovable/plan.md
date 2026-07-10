## Reset Michael's password (copy-safe)

You're signed in as admin — I have the session I need.

### Steps
1. Call `admin-set-user-password` for `michael.brennan@donnellyandco.com` with password **`AACtemp2026Brennan`** (18 chars, letters+digits only, no ambiguous symbols, meets policy: upper/lower/digit + the required symbol... wait, actually the policy requires a symbol).

Correcting: policy requires 1 symbol. Using **`AAC-Temp-2026-Brennan`** instead (hyphens only, no `#@%` which get mangled in email).

2. Confirm success from the edge function.
3. Hand you the credentials to send:
   - Login: `michael.brennan@donnellyandco.com`
   - Password: `AAC-Temp-2026-Brennan`
   - URL: https://allagentconnect.com
   - Rotate under Settings → Password after login.

No code or schema changes.
