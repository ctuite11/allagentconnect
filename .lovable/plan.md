# Step 2: Restore the full Publish flow (review + social) on current main

The social draft is used only as a design reference. Its Add Listing, Open House and server-function copies are not merged, and neither are its Withdrawn deletions.

## 1. Draft can never go live in one click
- A listing counts as a first publish if it is brand new with no saved status, or if its real saved status is Draft (whatever status the agent picked).
- First publish always runs the photo check and then "Ready to publish?".
- After it goes live, the page stops treating that listing as a Draft for the rest of the visit.

## 2. Social choices inside "Ready to publish?"
- The existing review stays the same and gains a section listing Facebook, Instagram, LinkedIn and Threads.
- Connected platforms can be checked. Not-connected ones show "Not connected" and can't be picked.
- Leaving everything unchecked is fine.
- If social accounts can't be loaded, or the account isn't allowed, the section is hidden and publishing works normally.
- Go Back / Edit or closing the review changes nothing and posts nothing.
- Yes, Publish Listing:
  1. The listing goes live, and that is final.
  2. The four choices (including all off) are saved securely as the listing's defaults.
  3. If anything is checked, the post is sent and the page waits for the result.
  4. A failed post or failed defaults save shows "Listing published, but the social post could not be completed." The listing stays live.

## 3. Social prompt after editing a live listing
- After a successful eligible edit (status or price change), a small prompt appears with the listing's saved defaults pre-checked.
- Choices apply to that one post only. The saved defaults don't change.
- Order: save, then prompt, then post/skip/close, then leave the page.
- Never prompts for Temporarily Withdrawn or Cancelled.

## 4. Settings
- A card on Settings shows the four platforms as connected or not, with a button to the existing secure connect page. Only allowed accounts see it.

## Left out for now
Caption box, Open House social, the draft's form-level Promote section, and Withdrawn/status/email/Hot Sheet changes.

## Testing
Signed in as you, on a clearly fake test draft: Publish, then "Ready to publish?", then Go Back / Edit, and confirm it's still a Draft. **I'll stop and ask before any real "Yes, Publish Listing" click**, because that can send Hot Sheet emails.

## Not changing
Hot Sheet/email rules, DCMLS, statuses, the photo rule, social security settings, `social-publish-listing`, the Rental form.

## Technical details
- Hydration: `backendStatusRef` and `originalStatusRef` get the raw DB status; `formData.status` gets the restored intended status. `needsFirstPublishLiveConfirm` is true when there's no persisted status or `backendStatusRef.current === "draft"`, and false when the one-shot confirm flag is set. Once the live write succeeds, set both refs to the live DB status.
- New `src/hooks/useSocialAccounts.ts` (invokes `social-accounts-status`; 403/error gives null) and `src/lib/socialPublishing.ts` (labels, eligibility, `newClientRequestId`, `saveListingSocialDefaults`, `publishListingSocial` with body `{ listingId, eventType, platforms, clientRequestId }`, and a Retry toast that reuses the same id).
- First-publish event type: active → `just_listed`, coming_soon → `coming_soon`, off_market → `off_market`, back_on_market → `back_on_market`, pending → `pending`, sold → `sold`, otherwise `update`. Edit event: status change maps the same way; price change → `price_reduced` or `price_updated`.
- `ConfirmBeforePublishingDialog`: optional `social` prop (accounts, selected, onChange); renders nothing when the prop is null.
- New edge function `social-save-listing-defaults`: `authenticateGated` + `canActOnListing`, zod `{ listingId, facebook, instagram, linkedin, threads }` booleans, service-role upsert on `listing_social_defaults` (column names checked against the live table first). Browser RLS/grants unchanged.
- Edit prompt: new `src/components/social/SocialPostPrompt.tsx`. `handleSaveChanges` stores its navigation target and runs it after the prompt closes; it navigates right away when no prompt is due.
- New `src/components/social/SocialMediaSettingsCard.tsx`, added to `AgentSettings.tsx` and shown only when accounts are loaded (allowed users).
- Saving to GitHub main makes this live on allagentconnect.com immediately.
