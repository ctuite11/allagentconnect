# Option B — test the review email, then publish

## What is already live

The last publish came after the Admin Approvals speed work, and the drawer wording change ("AAC activation/setup link (30 days, single-use)") landed before it — so production almost certainly already shows the new wording. The Admin Approvals speed pass and the Agent Network team search are live too.

## What is pending and would go live on the next publish

Concierge listing work only — nothing else is waiting:

1. Create-a-listing-for-a-member admin page (pick a verified member, prepare a Draft, reopen drafts, "Send to agent for review").
2. Listing form in concierge mode — same form, locked to Draft, no publish button for staff.
3. Review & Publish screen for members.
4. Sign-in and activation links can return the member to a specific listing.

Files: `AdminConciergeListings.tsx`, `ListingReview.tsx`, `conciergeListing.ts` (new); `AddListing.tsx`, `App.tsx`, `SignInLink.tsx`, `ActivateAccount.tsx`, `AgentAccountSetup.tsx` (modified). The matching backend is already deployed, so the live site currently has no way to reach any of it.

## Controlled end-to-end email test (before publishing)

Needs a test email address you control, and an AAC member account for the draft. No real member account is used or altered unless you name one.

Test steps:
1. Create a concierge Draft against the designated test account with clearly fake property data.
2. Press "Send to agent for review" and confirm exactly one email job is created.
3. Confirm the email is delivered to the test address.
4. Confirm the email shows the correct address, price, status, beds/baths and description for that draft, and the correct member name.
5. Confirm both buttons point at the correct listing, and that fetching the links does not redeem the token or publish anything.
6. Signed-out path: follow the link, complete sign-in (or activation), confirm landing directly on that listing — not the dashboard.
7. Signed-in path: follow the link while already signed in, confirm direct landing.
8. Confirm the Review & Publish screen loads the correct draft, and Edit opens the correct listing editor.
9. Confirm Publish runs the existing normal member publish flow (validation, photo order, normal alerts) — run this only if you want the publish leg tested live, since publishing triggers real buyer alerts.
10. Confirm no other listing, member, or email job changed; email queue count before and after recorded; test draft deleted afterwards.

## Cosmetic cleanup (included)

`src/components/admin/AgentEmailHistory.tsx` line 165 tooltip: "setup/recovery link" to "setup link". One word, no behavior change.

## Not in scope

No other frontend or backend changes. No publish until the email test passes and you approve.

## What I need from you

- The test email address.
- Whether that address already belongs to an AAC member account, or whether I should use a designated test member you name.
- Whether to include step 9 (a real publish, which fires real buyer alerts) or stop at the confirmation screen.
