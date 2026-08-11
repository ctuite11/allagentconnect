# Make the admin invite email come from Chris

## What you're seeing
The invite lands in the inbox as **All Agent Connect <hello@allagentconnect.com>**. Replies already route to chris@allagentconnect.com, but the visible sender is the brand, not you — which reads impersonal for what is a personal note.

## What changes
Only the sender's **display name** on the admin-created invite email:

```text
before:  All Agent Connect <hello@allagentconnect.com>
after:   Chris Tuite (All Agent Connect) <hello@allagentconnect.com>
```

The sending address stays `hello@allagentconnect.com`, the verified and reputation-warmed sender. Reply-To stays chris@allagentconnect.com. No template, copy, link, or transport change.

Scope: the admin-created agent invite only. Every other email keeps the current brand sender.

## Why not send from chris@ directly
The canonical sender is deliberately hard-locked to one verified address after past inbox-placement problems on other sender domains. Switching the From address for one email type would split the domain's sending identity and risk placement on exactly the email that matters most. A display name gets the personal feel at no deliverability cost.

## Technical detail
- `supabase/functions/_shared/transactionalSender.ts`: add a narrow, allowlisted display-name override helper (address still hard-locked; env cannot change the address).
- `supabase/functions/_shared/sendEmail.ts`: when the job payload carries an approved `from_display_name`, use it in the From header; otherwise keep `CANONICAL_TRANSACTIONAL_FROM` unchanged.
- `supabase/functions/send-admin-created-invite/index.ts`: set that display name on the queued job payload.
- Deploy the affected functions, then send one preview invite to chris@allagentconnect.com to confirm the inbox sender line before any real invite goes out.