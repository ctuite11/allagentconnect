## Goal
Create a polished, forwardable "Your license has been verified" email with a clear **Log In** CTA, matching the AAC brand (Navy header, Emerald accent, Green CTA) used by the Agent Forward invitation.

## Deliverables

1. **New shared template builder**
   `supabase/functions/_shared/buildLicenseVerifiedEmailHtml.ts`
   - Exports `buildLicenseVerifiedEmailHtml({ ctaUrl, preheader, agentName? })`
   - Same visual system as `buildAgentForwardEmailHtml.ts`:
     - Navy (`#111317`) header with AAC monogram + 2px emerald underline
     - White body card with brand border
     - Headline: **Your license has been verified**
     - Sub-copy: short confirmation that the account is approved and ready to use
     - Short "What's next" bullets (3 items, emerald squares, top-aligned — same bullet pattern as Agent Forward):
       - Complete your profile so other agents can find you
       - Add or import your listings
       - Start sharing listings and building Hot Sheets
     - Green CTA button **Log In to All Agent Connect** → `${PUBLIC_SITE_URL}/auth`
     - Navy footer with monogram + "By Agents. For Agents. All Agents."
   - Generic/forwardable: no personalized agent footer, no recipient-specific tokens, no expiring links

2. **New edge function**
   `supabase/functions/send-license-verified-email/index.ts`
   - Accepts `{ to: string | string[], ctaUrl?, subject?, agentName? }`
   - Enqueues into `email_jobs` with:
     - `template: "license-verified"`
     - `subject` default: **Your license has been verified — welcome to All Agent Connect**
     - `reply_to: "hello@allagentconnect.com"`
   - Kicks `kick-email-queue` after enqueue
   - Standard CORS + error envelope (matches `send-agent-forward-invite` shape)

3. **Deploy**
   - Deploy `send-license-verified-email`
   - Send one test to `chris@allagentconnect.com` so you have a forwardable copy in your inbox

## Out of scope (not changing now)
- No automatic wiring into the admin approval flow
- No DB triggers, no audit rows
- No changes to existing `send-license-upload-notification` (that's the admin-side notice)
