## Issue

Per-agent local-parts (`chris.tuite@mail.allagentconnect.com`) are brand-new sender mailboxes with zero reputation. Even with valid SPF/DKIM/DMARC on `mail.allagentconnect.com`, Gmail and Outlook score reputation per-address and route unknown mailboxes to spam during the warm-up period.

The previously-working address was `chris@mail.allagentconnect.com` (and the rest of the app uses `hello@mail.allagentconnect.com`), both of which have established sending history.

## Fix

Drop the per-agent local-part and keep one warmed-up mailbox. Put the logged-in agent's identity in the **display name** only — that's what the recipient sees first in their inbox preview ("From: Jane Smith").

### New sender format

- **From:** `Jane Smith <hello@mail.allagentconnect.com>`
- **Reply-To:** Jane's real personal email (e.g. `jane@kw.com`)

Recipient inbox shows **"Jane Smith"** as the sender. Hitting Reply emails Jane directly. The underlying mailbox is the established `hello@mail.allagentconnect.com` that already has good reputation in the queue.

### Changes

1. In `send-bulk-email/index.ts`, replace the per-agent local-part construction with:
   - `senderFrom = "{Agent Display Name} <hello@mail.allagentconnect.com>"`
   - `senderReplyTo = agent's profile email` (unchanged)
2. Fallback (lookup fails): `"All Agent Connect <hello@mail.allagentconnect.com>"`.
3. Redeploy `send-bulk-email`.
4. Send a test from a non-Chris agent account; confirm it lands in the inbox.

## Notes

- No DNS changes, no Resend changes, no new domains.
- This is the same pattern Mailchimp, HubSpot, and Gmail "Send mail as" use — one verified sending address, per-user display name, real-user reply-to.
- If you later want truly per-agent addresses (for vanity reasons), we'd need to warm each one up over weeks and accept early-spam risk — not recommended.