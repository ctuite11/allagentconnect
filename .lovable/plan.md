
## Audit + purge `chris@directconnectmls.com`

⚠️ **Heads up before approval**: `chris@directconnectmls.com` is very likely your **admin account** (per memory: `auth/admin-access-logic-standard` — admin user is `chris@allagentconnect.com`, but `directconnectmls.com` is one of your custom domains and may be the same person). Purging it would lock you out of admin.

### Step 1 — Audit (read-only)

Run the same 27-surface sweep as before, plus check `user_roles` for `admin` role attached to any resolved user ID. Output a single counts table.

### Step 2 — Decision gate

If the resolved user has the **`admin` role** OR the email matches your active login, **STOP** and surface the finding instead of purging. You confirm before I delete.

If it's just a stale test/CRM record with no admin role, proceed to Step 3.

### Step 3 — Purge (only if safe)

FK-safe deletion across all surfaces with rows, then invoke `delete-users` edge function for the auth account, then re-verify zero.

### Scope guardrails

- No schema changes.
- Other users untouched — every query scoped by resolved IDs/email.
- Admin-protection gate before any destructive action.

**Approve to run the audit. I will not delete without showing you the audit first if admin role is detected.**
