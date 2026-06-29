## Mark Yoni Haiminis as Active

Yoni (yoni.haiminis@compass.com, `90247777-254d-4773-92c9-62b8b42c509b`) has an auth account and a live listing (31 Kappius Path, coming_soon) but his `agent_settings.agent_status` is still `pending`.

### Data changes (insert-tool only, no schema change, no emails)

1. `agent_settings` for user `90247777-254d-4773-92c9-62b8b42c509b`:
   - `agent_status = 'verified'`
   - `verified_at = now()` (only if null)
   - `account_activated_at = now()` (only if null)
   - `approval_email_sent = true` (suppress future auto-send)

2. `agent_early_access` for `yoni.haiminis@compass.com`:
   - `status = 'verified'`
   - `converted_at = now()` (only if null)

### Result
Yoni moves from Pending into the **Active** tab in Admin Approvals. No License Verified email is sent; if he ever needs to log in he can use Forgot Password.
