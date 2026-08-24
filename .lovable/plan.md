# Personal sender identity for Admin → Send Email

## Current state (verified)

- Every outgoing email uses one hard-locked From: `All Agent Connect <hello@allagentconnect.com>`. The send layer explicitly ignores any per-message sender and always applies that canonical value.
- Admin one-off emails set only Reply-To (`chris@allagentconnect.com`), which is why Gmail shows them as platform mail.
- The only admin account today is Chris Tuite / chris@allagentconnect.com, with the name available from the profile record.

## Goal

Emails composed by hand in Admin → Send Email should look like they came from the person who wrote them:

```text
from:      Chris Tuite <chris@allagentconnect.com>
reply-to:  chris@allagentconnect.com
mailed-by: send.allagentconnect.com
signed-by: allagentconnect.com
```

All automated mail (invitations, Hot Sheets, notifications, system email) keeps the existing `hello@allagentconnect.com` identity — unchanged.

## Plan

1. **Allow a personal sender, narrowly.** Add an opt-in sender override that the send layer honours only when the message carries an explicitly approved personal sender. Everything without that marker keeps the canonical company From exactly as today.
2. **Guard against spoofing.** The override is accepted only when the address ends in `@allagentconnect.com` and matches the signed-in admin's own account email. Anything else is rejected and the email is refused rather than silently downgraded — no arbitrary From values.
3. **Resolve the admin's identity server-side.** The send-email function already verifies the caller and their admin role; it will look up that person's name and email from their profile and use `Name <email>` as the From, with the same address as Reply-To. The browser never chooses the sender.
4. **Show the sender in the composer.** Admin → Send Email displays a read-only "From: Chris Tuite <chris@allagentconnect.com>" line so it is obvious which identity will appear. The existing optional Reply-To field stays and, when filled, still wins.
5. **Deploy and verify.** Deploy the affected functions, then send one test to a mail-tester address and confirm the visible From, Reply-To, and that SPF / DKIM / DMARC all still pass with alignment intact.

## Notes and risks

- Resend must accept `chris@allagentconnect.com` as a sender; the root domain is already verified there, so the envelope stays on `send.allagentconnect.com` and DKIM continues to sign as `allagentconnect.com`. If Resend rejects the address, step 5 surfaces it immediately and we revert to the canonical From.
- No template content changes. No queue retries or backfills. No sends beyond the single verification test.
- Scope: the shared send layer (sender-override gate), the admin send-email function, and the admin composer screen. Automated email paths are untouched.

## Technical detail

- `supabase/functions/_shared/sendEmail.ts`: replace the unconditional `from: canonicalFrom` with canonical-by-default plus a validated `payload.from_override`, accepted only for `@allagentconnect.com` addresses.
- `supabase/functions/admin-send-email/index.ts`: after the existing admin-role check, read `first_name`/`last_name`/`email` from the caller's profile and enqueue with `from_override` and a defaulted `reply_to` of the same address.
- `src/pages/AdminSendEmail.tsx`: fetch and display the resolved sender line; no logic change to the send call itself.
- Deploy `admin-send-email` and `process-email-queue` (the shared send layer is bundled into the worker).
