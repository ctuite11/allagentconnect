# Send you the Facebook-group invite email (test copy to Chris only)

## What this is

You want to receive the current "Facebook community" agent invite email — the plain personal note from you (`buildAdminCreatedInviteEmailHtml`, template `admin-created-invite`):

- Subject: "Chris Tuite invited you to All Agent Connect"
- Plain-note body: "Since you're already a member of the All Agent Connect Facebook community, we created your account..."
- CTA: "Activate My Account"
- Signed: Chris Tuite, Founder, All Agent Connect

## What I'll do (one email, to you only)

1. Send **one test copy to chris@allagentconnect.com** via the existing admin send-email Edge Function (the `/admin/send-email` path), using the rendered Facebook-invite HTML.
2. The "Activate My Account" link will point to the public activate page as a **placeholder** (no real activation token created, no account touched) — this is a visual/deliverability test copy, not a functional setup link.
3. No other recipients. No changes to `email_jobs` beyond this single send. No template edits — this sends the email exactly as it exists today.

## What this does NOT do

- No invites sent to any of the Facebook-group lists you shared earlier.
- No agent accounts or activation tokens created.
- No template changes (the approved copy stays as-is).

If the rendered copy looks wrong when it lands in your inbox, tell me what to change and I'll update the template first, then resend a fresh test.
