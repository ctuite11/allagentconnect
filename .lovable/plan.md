# Concierge Handoff: "Send to Agent for Review" Email

Extends the concierge feature so the prepared draft is handed off entirely through one email. The member sees the listing we prepared, then either publishes it or edits it — with no hunting inside AAC.

## Answers to your two questions

**Does this need new email template / queue work?** Yes, but only additive. It needs one new email template (the listing-preview handoff email) added to the existing AAC unified email system, and one new queue entry type so the email is sent through the same queue every other AAC email already uses. No changes to any existing template, and no changes to how the queue works.

**Does creating a draft stay silent?** Yes. Creating and editing a concierge draft sends nothing. The only thing that ever sends an email is an admin explicitly pressing "Send to Agent for Review". That is a deliberate, separate action with a confirmation step.

## Admin workflow

1. Admin picks a verified, activated member and prepares the draft (already built).
2. When ready, admin presses **Send to Agent for Review** on that draft.
3. A confirmation appears naming the member and the email address it will go to.
4. The email is queued and sent. The draft page then shows "Review email sent to <name> on <date>", plus a "Send again" option.

## The email the member receives

Branded as AAC, with a preview built from the actual draft:

- Main listing photo
- Address
- Price (or price range)
- Intended status (Draft / Coming Soon / Off Market) where applicable
- Beds / baths / square feet / property type
- Short description
- Framing line: "We prepared this listing for you. Review it below, then publish it as-is or make any changes first."

Then two large buttons:

- **Review & Publish Listing**
- **Edit / Update Listing**

Wording never implies AAC accessed their account. No "we added this to your account", no "we logged in for you".

## Publish safety

Nothing publishes from an email click. Both buttons are navigation only; mail scanners that auto-open links cannot publish, edit, or consume a sign-in token.

- "Review & Publish" lands on a new review screen for that draft where the member sees the full listing and presses Publish themselves.
- Publishing only ever happens from that explicit in-app confirmation.

## Getting them straight to the listing

- Already signed in: the link lands directly on the review (or edit) screen for that draft.
- Not signed in: the existing secure sign-in-link flow runs, then delivers them to that same screen. The member presses one "Sign In" button; the link is single-use and never exposes credentials or account information.
- Never activated their account: the existing activation/setup flow runs first, then delivers them to the draft.

No dashboard navigation, no searching, no "find my drafts".

## What gets recorded

Using systems already in place:

- Draft created (owner, admin who entered it, timestamp, source) — already recorded.
- Review email sent: timestamp, recipient, listing ID, admin who sent it.
- Publish: recorded by the existing listing audit system when the member publishes.

Email opens/clicks use only the tracking the AAC email system already does. No new invasive tracking is added.

## Technical section

**New review screen**
- Route `/agent/listings/review/:id` (agent-guarded), read-only summary of the draft plus "Publish listing" and "Edit listing" actions. Publish reuses the existing AddListing publish path (status transition, first-publish photo-order confirmation, normal alert/Hot Sheet triggers) — no new publish logic, no new status rules.

**Deep links and auth**
- Email buttons point at `/agent/listings/review/<id>` and `/agent/listings/edit/<id>`.
- For unauthenticated recipients the buttons point at the existing `/signin-link#t=<token>` page with a `returnTo` value carried to the destination; `AuthCallback` already honours `returnTo` via `resolvePostAuthRedirectWithMeta`, and `sanitizePostAuthRedirectCandidate` keeps it internal-only. `redeem-login-token` / `redeem-activation-token` stay POST-only and must thread the destination through the generated `redirectTo` rather than accepting it from a GET.
- Tokens are issued with the existing 30-day AAC token RPCs. The review email needs a token issued *with* the email (the emailing RPCs), unlike the admin copy-link path which uses the `_no_email` variants.

**Email**
- New shared builder `buildConciergeReviewEmailHtml.ts` reusing `renderSearchStyleListingEmailCard` from `_shared/listingEmailCard.ts` and the AAC unified template wrapper, so branding and the unsubscribe/category handling stay identical.
- New template name (e.g. `concierge-listing-review`) enqueued into `email_jobs` with the correct category; the plaintext token is never stored — the job carries the token id and the worker re-derives it at send time, matching `hydrateLoginLinkEmail`.
- Individual, person-to-person send — it should appear in the admin "Last Email" column and be excluded from all bulk paths.

**Edge functions**
- New `send-concierge-review-email` (admin JWT + `has_role('admin')` gate): loads the draft, confirms `creation_source='admin_concierge'` and `status='draft'`, confirms the target agent is verified + activated, issues the token, enqueues the job, stamps the sent metadata. Sends nothing else.
- `admin-create-listing-for-agent` and `admin-manage-concierge-listing` are unchanged and remain silent.

**Storage of send metadata**
- Sent timestamp / recipient / sender recorded through the existing `listing_audit_events` trail, avoiding any schema migration. If a column-backed indicator is preferred on the admin list, that would be an additive nullable column — flag before doing it.

**Unchanged**
- No RLS changes, no impersonation, no credentials, no existing template edits, no changes to listing status rules, alerts, Hot Sheets or Comms. Concierge drafts remain draft-only for staff; only the member can publish.

## Testing

Draft-only test listing, sent to an AAC-controlled address; verify a single queued email, correct preview content, both links landing on the right screens signed-out and signed-in, no publish possible from a link fetch, no Hot Sheet rows before the member publishes, then delete the test listing.
