# Admin: share any agent's listing to AAC's social pages

## What you'll get
On any listing's property page, admins see a **Share to social** button next to the existing Share menu. Clicking it opens a small chooser that lists the networks connected in Settings → Social Publishing (AAC's pages). Choose networks, click **Share**, and the post goes out on AAC's pages.

The link in the post opens that listing's public page on allagentconnect.com, where the **listing agent** is the contact. It doesn't credit the admin.

## Rules
- Only admins see the button. What agents and buyers see doesn't change.
- If no AAC accounts are connected, the button opens a prompt with a **Connect** link to Settings.
- Hidden for Draft, Temporarily Withdrawn, and Cancelled listings. These are the same blocked statuses used today.
- The caption is built from the listing's current status (Just Listed, Coming Soon, Sold, etc.). It uses the same caption builder as agent posts.
- Each click is one post. Failures show the existing error toast with a Retry button, and retrying won't post twice.
- Nothing posts until you click Share.

## Technical details
- The backend needs no changes. `social-publish-listing` already lets admins act through `canActOnListing`. It posts through the caller's own Bundle team, so for an admin that's AAC's pages. The link comes from `publicListingUrl` → `/property/:id`, which shows the listing agent.
- Frontend only:
  - In `src/pages/PropertyDetail.tsx`, when `isAdmin` is true and the status passes `isSocialEligibleStatus`, render a new button next to the `SocialShareMenu` (around line 770).
  - New `src/components/social/AdminSocialShareDialog.tsx`. It reuses `SocialPlatformChoices`, `fetchSocialConnected`, `openSocialConnectPortal`, and `publishListingSocial`, with `statusToSocialEventType(listing.status)` and a new `clientRequestId` for each dialog open.
- Untouched: listing data, the listing's social defaults, the agent Add Listing flow, emails, and Hot Sheets.
- To verify: run a type-check, then make sure the button shows only for an admin and opens the chooser. I won't post anything to social while testing. Your first real share is yours to make.
- Goes live through GitHub main → Netlify. No Lovable Publish.
