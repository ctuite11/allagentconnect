Change the "Founding Partners →" CTA in the founding-partner email to point to the correct page.

**File:** `supabase/functions/send-bulk-email/index.ts` (line 305)

- From: `https://allagentconnect.com/register?source=founding_partner`
- To: `https://allagentconnect.com/auth?mode=register`

Then redeploy `send-bulk-email`. No other content changes.