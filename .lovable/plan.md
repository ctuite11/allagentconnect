# Redesign the Create Agent invitation email (preview first, nothing live)

## Scope
Redesign only the email agents receive when an admin creates their account ("admin-created-invite"). No other email, Hot Sheet, notification, database, onboarding or verification change. Nothing sent, deployed or resent until you approve the finished design.

## What changes
- **Subject:** "Your Next Deal Starts With a Connection." (replaces the current default subject for new sends only)
- **Preview text:** your exact line.
- **Layout (white background, responsive, table-based for Gmail/Outlook/Apple Mail/mobile):**
  1. AAC logo at top (existing approved hosted AAC lockup/monogram, not redrawn).
  2. Hero residential property photo (hosted, optimized ~100–150 KB, with alt text).
  3. Headline, subhead, intro paragraph — your exact copy.
  4. Green "ACTIVATE YOUR FREE ACCOUNT" button.
  5. "Discover What All Agent Connect Can Do for You" — six compact feature blocks with small hosted icons, your exact copy.
  6. Closing section, second green button, Chris Tuite signature and www.allagentconnect.com.
- **All Facebook-group language removed.**
- All text is real HTML; with images blocked the email still reads fully and both buttons still work (buttons are styled HTML, not images).

## What stays exactly the same
- Resend sending, sender address, reply-to, authentication.
- Per-recipient activation link created at send time from the existing 30-day token; both buttons use that same link. No new tokens or invitations.
- Queue, pacing, retry/idempotency, tracking configuration, expiration rules.
- Existing footer/compliance elements.

## Before you approve, I will show you
- Desktop and mobile screenshots, images on and images off, rendered from preview data with a placeholder link (no real token, no send).
- Confirmation the logo is the existing approved asset.
- A feature-accuracy check: each of the six claims checked against what's live today. Note: "Buyer Needs & Matching" and "Off-Market & Coming Soon" exist; I'll flag any wording that overstates (e.g. "hundreds of agents" — directory currently shows 334 agents, so "hundreds" is accurate).
- Proof no other template file changed.

## Open questions (answer when reviewing)
- **Hero photo:** I'll use an existing homepage property photo if suitable; otherwise generate a realistic residential photo. Say if you'd rather supply one.
- **Plain-text fallback:** the email system currently sends HTML only. Adding a text version means a small change in the shared send step (only used when a text version is provided, so other emails are unaffected). I'll include it only if you approve that.

## Technical details
- Edit only `supabase/functions/_shared/buildAdminCreatedInviteEmailHtml.ts` and the default subject in `send-admin-created-invite/index.ts`; `hydrateActivationEmail.ts` call stays as-is (ctaUrl late-rendered).
- Images hosted in the existing public `brand-assets` storage (absolute https URLs).
- Preview rendered locally via a throwaway script to `/tmp`, screenshots with Playwright at 600px and 375px, images blocked via request interception.
- Optional text fallback: `text` field passed through to Resend only when present.
- Edge functions not deployed until you approve.
