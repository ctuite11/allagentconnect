# Social sharing: one button per network, and a cleaner connection page

## 1. "Ready to publish?": one button per network
Checkboxes and status lines are removed. Each row is the network name plus one button:

```text
Facebook                     [Connect]    not connected
Instagram                    [Share]      connected, not chosen
LinkedIn                     [✓ Share]    chosen for this listing (AAC blue)
```
- **Connect:** opens the explainer box ("Connect social media for publishing"), then Bundle. After you return the button reads **Share**, not selected. You choose it yourself.
- **Share / ✓ Share:** switches that network on or off for this listing only. It never disconnects anything.
- **Disconnecting and managing** stay only in **Settings → Social Publishing**.
- **Loading:** the box uses the last known connection status straight away and refreshes quietly. If nothing is known yet, the buttons sit in a plain, stable "…" state, then update without resizing the box. The server still checks each account again before any real post.
- **"Share this update?"** after later edits uses the same Share / ✓ Share buttons, with no Connect.

## 2. Bundle connection page
Changes use only options Bundle documents:
- **Only the network you clicked:** clicking Facebook asks Bundle for Facebook only, instead of all four. Settings "Connect accounts / Manage connections" still shows all four.
- **Your name, not an internal code:** the account label changes from "AAC Agent 1fc50da1" to "All Agent Connect – [Agent Name]", for new setups and by updating existing ones through Bundle's documented team update.
- **AAC logo and hiding "Powered by bundle.social":** applied only if Bundle's documented options and our plan allow it. I'll confirm the exact option names in Bundle's docs first. If they aren't available, I'll report that and change nothing there.
- **Facebook "Choose Connection Type" screen:** Bundle documents a `withBusinessScope` option that controls whether business permissions are requested. AAC only needs normal (organic) posting, so the plan is to request standard access and skip the business and ads permissions. Before switching, I'll confirm in Bundle's docs that this removes the extra screen and still allows Page posting. If it doesn't, I'll report back with the options instead of guessing.

## Not changing
Posting, Hot Sheets, email, listing publishing, social defaults, sign-in security, the single final "Yes, Publish Listing".

## QA
- **Checks:** code checks, plus the publish review on a disposable Draft with Bundle stubbed. Stop at Go Back, then delete the Draft while it's still a Draft.
- **Real connection:** the one real end-to-end connect-and-publish test uses a rental listing, only with your go-ahead at that time.
- **Report back:** exactly which Bundle options were available.

## Technical details
- `SocialPlatformChoices`: rows become a `Button` per platform (`outline` for Connect and Share, primary with a check for selected). `onConnectRequest` is still first-publish only. The prefetch cache in `AddListing` is reused, with a neutral state when nothing is cached.
- `social-connect-portal`: accept an optional `platform`, validated against `PLATFORMS`, and send `socialAccountTypes: [platform]` when given. Add `withBusinessScope: false` once verified. Add branding fields only if they're documented. Rename the team on create and lazily update the name for existing teams. Redeploy only this function.
- `openSocialConnectPortal(returnUrl, platform?)`: passes the platform through.
