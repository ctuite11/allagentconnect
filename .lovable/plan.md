# Forwardable AAC-branded invite — short, bulleted

Send you one copy at chris@allagentconnect.com that you can forward to any agent as-is.

## Which email
The existing **personal forward invite** already carries full AAC branding (navy header with the emerald monogram, centered headline, blue CTA, your signature, dark footer). It's the right base — it just runs long. This plan trims the body and leads with bullets.

## Shortened copy

Subject: You're invited to join All Agent Connect

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

Three intro paragraphs plus a closing paragraph collapse into one sentence; the highlights carry the message.

## Delivery
- One send to chris@allagentconnect.com only. No audience send, no queue backfill, no cron change.
- The CTA points at the normal sign-up page, so nothing is tied to your account and the link stays valid for whoever you forward it to.

## Technical detail
- Trim the copy in `supabase/functions/_shared/buildPersonalForwardEmailHtml.ts` (bullet list + single intro line); keep the branded shell, colors, and footer untouched.
- Deploy `send-personal-forward-invite`, invoke it once for chris@allagentconnect.com with a dated idempotency key, and confirm the job reaches `sent` in `email_jobs`.