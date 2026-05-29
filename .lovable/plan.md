## Root cause

Resend is rejecting every send with:
> "The allagentconnect.com domain is not verified."

Only `mail.allagentconnect.com` is verified for sending. Recent changes set the From address to `chris@allagentconnect.com` (root domain), which Resend won't accept.

## Plan

1. **Fix the From address** in the queue worker and bulk-email path:
   - From: `Chris Tuite <chris@mail.allagentconnect.com>` (verified subdomain)
   - Reply-To: `chris@allagentconnect.com` (so replies still land in your real inbox)
   - Applies to both single-recipient and multi-recipient sends.

2. **Keep privacy + individual delivery** behavior unchanged (one email per recipient, no shared To list).

3. **Redeploy** `process-email-queue` and `send-bulk-email`.

4. **Verify** by sending one test email and confirming the queue logs show a successful send instead of a 403.

Optional follow-up (not in this fix): verify the root `allagentconnect.com` domain in Resend so we can send directly from `chris@allagentconnect.com` later.