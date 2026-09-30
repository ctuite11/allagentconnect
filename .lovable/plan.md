# Ready to publish? — open instantly at full size

## Problem
Right now the review opens with only the listing details. The social section is hidden until the social-account check finishes, then it pops in and the box grows.

## What changes
1. Clicking Publish opens the full "Ready to publish?" box at its final size right away. Cover photo, address, type, beds, baths, sq ft, price and status come from what's already on the page, so they show immediately. (They already do.)
2. For the listing owner, the "Share on social media" section with all four rows (Facebook, Instagram, LinkedIn, Threads) shows from the first frame.
3. While the check is running, each row shows a small "Checking…" on the right, and its checkbox is unchecked and disabled.
4. When the check finishes, each row switches to Connected (checkbox enabled) or "Not connected — click to connect" (same as today).
5. If the check fails, the rows stay visible with "Status unavailable" and disabled checkboxes, so the box doesn't shrink. **This replaces your earlier rule to hide the whole section when the check fails.** Publishing still works without social.
6. "Yes, Publish Listing" never waits for the check. While it's running, nothing can be selected, so the listing publishes without social.
7. To make "Checking…" rarely visible, the check also runs in the background as soon as an owner opens the editor. Clicking Publish shows that result immediately and refreshes it quietly.
8. Admin, delegate or concierge edits of someone else's listing: no social section at all, known instantly, so no layout jump.

## Not changing
Publish rules, photo requirement, Hot Sheets, social defaults, posting, the connect-and-return flow, the later "Share this update?" prompt.

## QA (no real publish)
Use one fake Draft. Check Publish → full box appears at once with "Checking…" rows → rows update without resizing (measure box height before and after). Check a failed-status case with a stubbed error. Click Go Back, never "Yes, Publish Listing". Delete the Draft while it's still a Draft and confirm it has no history, Hot Sheet, email or social records. Check on desktop and mobile.

## Technical details
- `SocialPlatformChoices`: new optional `status: "loading" | "ready" | "error"` prop. When it's loading or error, pass a list of all-false platforms, disable every checkbox, and put "Checking…" or "Status unavailable" on the right.
- `ConfirmBeforePublishingDialog`: pass `social` as an object with a status whenever `isSocialOwner()`. Pass null only for non-owners.
- `AddListing.tsx`: track `publishSocialStatus`. Prefetch the connection status when an owner opens the editor and keep it in a ref. When the dialog opens, use the cached value right away and refetch it. The resume restore still waits for the refreshed status. In `handleConfirmPublish`, capture selections only when the status is ready.
