# Pending (unpublished) frontend work — inventory and publish decision

Backend for Copy setup link is already live. The question is what else is sitting in the unpublished frontend.

## What is already live

The last publish was made right after the Admin Approvals speed work. The drawer wording change ("AAC activation/setup link (30 days, single-use)") landed **before** that publish, so production almost certainly already shows the new wording. I could not fetch the live site from here to confirm byte-for-byte, so treat this as high-confidence but unverified.

The Admin Approvals speed pass (faster roster load, Last Email = personal sends only) and the Agent Network team search are both in that same published state.

## What is pending and would go live on the next publish

Everything below is concierge-listing work; nothing else is waiting.

1. **Create a listing for a member (admin page)** — new admin screen to pick a verified member, prepare a Draft listing for them, reopen drafts, and press "Send to agent for review".
2. **Listing form in concierge mode** — the existing Add Listing form, saved through the admin-only server path, locked to Draft, no publish button for staff.
3. **Review & Publish screen for members** — new page showing the prepared draft with Publish and Edit actions; Publish runs the normal publish flow.
4. **Sign-in and activation links can return to a specific listing** — small additions so a member who follows the review email lands on that listing instead of the dashboard.

Files: `AdminConciergeListings.tsx`, `ListingReview.tsx`, `conciergeListing.ts` (new); `AddListing.tsx`, `App.tsx`, `SignInLink.tsx`, `ActivateAccount.tsx`, `AgentAccountSetup.tsx` (modified). Nothing outside these.

Note: the matching concierge backend functions are already deployed, so today the live site simply has no way to reach them. Publishing turns the feature on for admins; it changes nothing for members until staff actually send a review email.

## Known open item before publishing the concierge feature

No live end-to-end test of the review email has been run — that would deliver a real email. A test address is needed first.

## Wording cleanup (separate, cosmetic)

One admin tooltip in the email history panel still says "setup/recovery link". A one-word change to "setup link". Not functional; can ride along with any publish.

## Options

- **A — Publish everything now.** Concierge feature becomes usable by admins; review email still untested end-to-end.
- **B — Test the review email first, then publish everything.** Needs a test address.
- **C — Hold the concierge feature; publish nothing.** The drawer wording is already live, so there is nothing urgent to isolate.

Recommendation: B, with the tooltip cleanup included.
