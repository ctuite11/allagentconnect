## Goal

Rebuild the Early Access update email from scratch as a simple, calm "first look" at what we've built — no marketing spin, no references to lawsuits or market noise. Just the product, shown via the agent's own real screenshots.

## Approach

Replace the current `early-access-update-v1` template in `supabase/functions/send-bulk-email/index.ts` with a clean, minimal layout:

1. **Brand header** — AAC logo + monogram (already hosted in the `email-attachments` bucket)
2. **Intro** — 2–3 sentences: "A quick first look at what we've built. Launching soon."
3. **Six sections in order**, each as a full-width screenshot + caption:
   1. Homepage — *caption only, no description*
   2. Success Hub — screenshot + short description
   3. Search Results — screenshot + short description
   4. Comms Center — screenshot + short description
   5. Agent Referral Network — screenshot + short description
   6. Footer — *caption only, no description*
4. **Sign-off** — short note from Chris, contact info, no CTA pressure

## Screenshots

The 4 already uploaded (homepage, comms, referral network, footer) will be used as-is — **not edited, not regenerated**. The 2 missing screenshots (Success Hub, Search Results) will be uploaded by the user in the next message before I build.

I will:
- Copy each uploaded screenshot into `src/assets/email/early-access-v2/` (new folder so we don't disturb v1)
- Upload the 6 files to Supabase Storage at `email-attachments/early-access-v2/` so they're served from public CDN URLs in the email
- Reference them in the template via the `STORAGE_BASE` URL pattern already used by the edge function

## Descriptions (draft — to be confirmed)

Short, factual, ~1 sentence each. No hype.

- **Success Hub** — "Your daily command center: active buyers, live listings, and what needs your attention today."
- **Search Results** — "Search the full network — your listings, partner-agent listings, and off-market inventory in one view."
- **Comms Center** — "Agent-to-agent collaboration: buyer needs, sales intel, rental demand, and direct discussion — all opt-in."
- **Agent Referral Network** — "A vetted directory of verified agents for referrals, introductions, and trusted collaboration."

You can rewrite any of these before I build.

## Template selection

Keeps the existing `early-access-update-v1` value in the dropdown working (so old drafts don't break) and adds a new option `early-access-update-v2` in `BulkEmailDialog.tsx` and the edge function's template switch. v1 stays as a fallback; v2 becomes the recommended choice.

## What I need from you before building

1. Upload the 2 missing screenshots: **Success Hub** and **Search Results**
2. Confirm (or rewrite) the 4 caption descriptions above
3. Confirm the sign-off line / contact block (use the footer's "Chris Tuite, Founder, 617-877-0519, chris@allagentconnect.com"?)

Once I have those, I'll build v2, deploy the edge function, and you can preview by sending a test to yourself via "Send a copy to myself".
