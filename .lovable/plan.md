# Simplify social media — Profile links only, connect when sharing

Replaces the previous plan. Profile is only for links. The publish/authorize decision happens in the listing flow, not in Profile.

## How it works, step by step (plain language)

**Setting up (one time):**

1. Open **Profile → Social Media** and paste your Facebook, Instagram, LinkedIn, Threads, X, and Website links. Click **Save**.
2. That's it. Your links appear as icons on your public profile. There are no connection lines or buttons here anymore.

**Publishing a listing with social sharing:**

1. You publish as you do now. In the **Ready to publish?** screen, check the platforms you want to share to (Facebook, Instagram, LinkedIn, Threads).
2. If a platform you checked is already connected, nothing extra happens — continue and click **Yes, Publish Listing**.
3. If a platform you checked is not connected yet, the hosted sign-in page opens (same tab). Sign in to that platform there.
4. You come straight back to the **Ready to publish?** screen. If you completed the sign-in, that platform is checked and available. If you canceled it, it shows "Not connected" and is unchecked — click it again to retry, or publish without it.
5. Click **Yes, Publish Listing** — the only final confirmation, exactly as today.
6. If you skip social entirely, you can still publish the listing; just leave the platforms unchecked.

In short: **Add my Facebook once → check Facebook when publishing → authorize it the first time if needed → publish.**

## Profile → Social Media

- Only the six link boxes: Facebook, Instagram, LinkedIn, Threads, X, Website. Saved in `social_links` as today; Threads needs no migration.
- **Removed:** the "Publishing connection: Connected / Not connected" lines, the **Connect for Publishing** / **Manage Connection** buttons, the "Public profile/page" label, and the connection-status load. `fetchSocialConnected()` is no longer called on Profile.
- Public profile icon display (including the new Threads icon) is unchanged.

## Ready to publish? (first publish)

The social checkboxes stay where they are. New behavior for a **not-connected** platform:

1. In the first-publish review only, a not-connected platform is clickable: checking it triggers the connection step. The later-update prompt keeps its current disabled behavior.
2. The connection step saves the listing as a Draft first (a brand-new listing may not exist yet) and **opens the hosted portal only after the Draft save definitively succeeds and returns the listing ID**. If the save fails, stay on the editor with the error. Then the existing hosted portal opens in the same tab, with a return URL back to the editor.
3. On return, the editor reopens **Ready to publish?** and refreshes connection status. Then:
   - **Authorization succeeded** → the platform is restored as checked and connected.
   - **Authorization not completed** → the platform is shown as "Not connected" and left **unchecked** — a checked box must never promise a post that can't happen. Clicking it again retries authorization.
4. The agent continues with **Yes, Publish Listing** — still the only final confirmation. Canceling authorization or closing the review never publishes anything, and the agent can always publish with no platforms checked.
5. Fail-closed: if connection status is unavailable (gated agent or request failed — `fetchSocialConnected()` returns `null`), the not-connected platforms stay disabled with no connect attempt, exactly as today.

First-publish defaults are unchanged: whatever is checked at the moment of publish becomes the listing's saved defaults.

## Later listing changes

Unchanged: saved defaults pre-check the update prompt, choices apply to that post only, and no reconnection is asked unless the provider itself requires it. Not-connected platforms remain disabled in the update prompt (no connect flow there) — this is not changing in this task.

## Settings

Keeps the current pointer card with **Go to Profile**, but the wording changes to **"Manage your social profile links from your Profile."** — Profile no longer manages publishing connections.

## Not changing

- Server functions (`social-accounts-status`, `social-connect-portal`, `social-publish-listing`, `social-save-listing-defaults`), `agent_social_accounts`, one Bundle Team per agent.
- Publishing rules, first-publish detection, photo gate, Hot Sheets, email, DCMLS, listing status logic, social-event idempotency.
- The saved-Facebook-URL ≠ authorization rule stays true: a link never grants posting rights; only the hosted sign-in does.

## Technical details

- `src/components/profile-editor/SocialLinksSection.tsx`: drop `fetchSocialConnected` usage, `connected` state, the connection row, and the connect button; drop the `platform` field and "Public profile/page" label. Link boxes only.
- `src/lib/socialPublishing.ts`: add `connectSocialPlatform(returnUrl)` — thin wrapper over the existing `openSocialConnectPortal` (same function, new name/usage site). No server change.
- `src/pages/AddListing.tsx` (review dialog path):
  - In `SocialPlatformChoices` usage for first publish, checking a not-connected platform calls `handleConnectFromReview(platform)`.
  - `handleConnectFromReview(platform)`: the Draft save must return something definitive — change the relevant save path to `Promise<string | null>` returning the saved listing ID (the current autosave-style `handleSaveDraft(true)` returns `void` and suppresses the save-error toast, so it is not a strong enough success signal). Only after a confirmed save with a listing ID: stash the resume state in `sessionStorage` under `aac-social-resume-<listingId>` as `{ listingId, selected platforms, pendingPublishAction: "publish" | "saveChanges" }` (a brand-new listing and an existing Draft enter first publish through different handlers), then open the hosted portal with the return URL below. If the save fails, stay on the editor and show the error — never open the portal.
  - Return URL: `/agent/listings/edit/<id>?social=resume&from=<existing-safe-from>` — preserve the editor's existing safe `from` value when it exists, so Back behavior after the authorization round-trip stays exactly as it is (e.g., an agent who came from My Listings keeps that context).
  - On load, `?social=resume` + a listing ID + a sessionStorage entry → reopen the review dialog, re-fetch connection status, then restore the saved selections. The restore must happen **after** the refreshed connection-status call and deliberately bypass the existing `setPublishSocialSelected([])` reset that runs when the dialog opens, or the saved choices would be wiped. Then clear the sessionStorage entry and the query param.
  - Keep the existing `pendingFirstPublishSocialRef` publish-time flow untouched.
- `SocialPlatformChoices.tsx`: first-publish usage needs an `onConnectRequest` callback; the update-prompt usage passes none, so its disabled behavior is unchanged.
- Launch gate unchanged: gated agents see `null` status → checkboxes disabled, no connect attempt; the portal server still refuses non-gated agents.

## QA (no real publish, no post)

1. Profile shows only link boxes; save/reload keeps links; no connection lines or buttons anywhere on Profile.
2. Ready to publish? with a connected platform checked → no redirect, flow as today.
3. Ready to publish? with a not-connected platform checked → Draft saved (stays Draft) with the save confirmed before any redirect, hosted portal opens same-tab; return without connecting → review reopens with that platform **unchecked**, shown "Not connected"; clicking it again retries authorization; publish remains possible with nothing checked.
4. Cancel/close the review at any point → no publish, no status history, no Hot Sheet, no email, no social post, no defaults saved.
5. Update prompt (live-listing edit) behaves exactly as today; no connect flow there.
6. Tab count never increases.
7. Enter the editor from My Listings, run the authorization round-trip, cancel, then Back → lands on My Listings as before (`from` preserved).
