## Plan: fix License Verified verification email link stuck loading

### Scope
This is only for the **License Verified email link** flow:

`License Verified email CTA → AAC /auth/setup → auth verify URL → /auth/callback?type=recovery&setup=1 → /agent-setup`

No buyer invite, hot sheet, listing-share, or DCMLS consumer flows will be touched.

### Root issue
The screenshot is the `/agent-setup` loader: **“Verifying your activation link…”**.

That page currently waits for session validation and agent profile prefill before it turns off loading. If any step stalls or throws, it can stay loading forever. The email link itself is reaching AAC, but the final setup page does not fail safely.

### Fix
1. **Harden `/agent-setup` initialization**
   - Wrap setup initialization in `try/catch/finally`.
   - Always end loading, even if profile lookup fails.
   - Treat agent profile prefill as optional, not blocking.
   - Add a short fail-safe timeout so the user sees an error panel instead of an infinite loader.

2. **Keep the License Verified link on password setup**
   - Preserve the existing AAC-pinned recovery/setup link behavior.
   - Do not send users to plain `/auth` unless the setup link is invalid/expired.

3. **Route correctly after setup**
   - After password is set, resolve the user’s actual role.
   - Admin routes to `/admin/approvals`.
   - Verified agent routes to `/agent-dashboard`.
   - If role resolution fails, show a clear error instead of hanging.

4. **Verification**
   - Re-send the License Verified email to `chris@allagentconnect.com`.
   - Confirm the CTA starts on `allagentconnect.com` and reaches the password setup/reset flow.
   - Confirm it no longer gets stuck on “Verifying your activation link…”.