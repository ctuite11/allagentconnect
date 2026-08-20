# Forwardable AAC-branded invite — send updated copy

Send one copy of the updated personal forward invite to chris@allagentconnect.com so it can be forwarded to any agent as-is.

## Current state
- The existing plan (`forwardable-aac-branded-invite-short-bulleted-2026-08-11`) already defined the short, bulleted version.
- `supabase/functions/_shared/buildPersonalForwardEmailHtml.ts` still contains the long paragraph version and needs to be trimmed to the short copy.

## Shortened copy to use

Subject: You’re invited to join All Agent Connect

```text
Hi there,

I'd like to invite you to All Agent Connect — a private network built
for real estate agents. Here's what you get:

  • Seller and buyer leads
  • Buyer and renter needs from other agents
  • Off-market and coming-soon listings
  • Instant alerts on new listing activity
  • Referrals and agent-to-agent opportunities
  • Direct connections with verified agents
  • Free for a limited time, licensed agents only

[ Create your account → ]

Thanks,
Chris Tuite
Founder, All Agent Connect
```

## Steps
1. Trim the body in `supabase/functions/_shared/buildPersonalForwardEmailHtml.ts` to a single intro line + bullet list, keeping the branded header, colors, blue CTA, signature, and dark footer untouched.
2. Deploy the `send-personal-forward-invite` Edge Function.
3. Invoke it once with recipient `chris@allagentconnect.com` and a dated idempotency key.
4. Confirm the job reaches `sent` status in `email_jobs`.

## Delivery rules
- One send to chris@allagentconnect.com only.
- No audience send, no queue backfill, no cron change.
- The CTA points to the normal sign-up page so the link stays valid for whoever you forward it to.
