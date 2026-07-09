## Set a password for Jeff Goldman

Target user: **Jeffrey Goldman** — `Jeff@homesboston.com` (id `b0bb16b9-…`)

### Steps
1. Generate a strong random password (16 chars, mixed case + digits + symbol, meets the password policy).
2. Call the existing `admin-set-user-password` edge function as the current admin, passing `{ email: "jeff@homesboston.com", password: <generated> }`.
   - This uses service role to `auth.admin.updateUserById` and marks email confirmed.
   - It also flips `agent_settings.agent_status` from `invited` → `verified` and stamps `account_activated_at` if not yet set.
3. Return the generated password back to you in chat so you can send it to Jeff.

### Notes
- Nothing else changes (profile, roles, early-access untouched).
- Jeff can change it later at Settings → Password.
- Confirm the password shape you want (default: 16 chars, e.g. `Xk7m-Qp2vNr8Ht4W`) or tell me to use a specific one.