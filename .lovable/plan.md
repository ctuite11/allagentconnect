# Social sharing: one button per network, and a cleaner connection page

## 1. "Ready to publish?": one button per network
Checkboxes and status lines are removed. Each row shows only the network name and one button, with no other text:

```text
Facebook   [Connect]
Facebook   [Share]
Facebook   [✓ Share]   (AAC blue)
```
- **Connect:** the network isn't connected yet. It opens the explainer box ("Connect social media for publishing"), then the connection step. After you return the button reads **Share**, not selected. You choose it yourself.
- **Share / ✓ Share:** switches that network on or off for this listing only. It never disconnects anything.
- **Disconnecting and managing** stay only in **Settings → Social Publishing**.
- **Loading:** the box uses the last known connection status straight away and refreshes quietly. If nothing is known yet, the button sits in a plain, stable disabled state, then updates without resizing the box. The server still checks each account again before any real post.
- **"Share this update?"** after later edits uses the same Share / ✓ Share buttons, with no Connect.

## 2. Connection experience
- **Connect from "Ready to publish?":** I'll first check Bundle's documented single-platform `connect-url`. If it takes the agent straight from the AAC explainer into that network's own sign-in and back to AAC, it's used there, which skips the extra Bundle page. If it doesn't, the hosted page is used, filtered to only that network.
- **Settings "Connect accounts / Manage connections":** keeps the hosted page with all four networks.
- **Branding on the hosted page:** the AAC logo (`logoUrl`), "Powered by bundle.social" hidden (`hidePoweredBy`), and AAC back-button text, all through Bundle's documented options.
- **Your name, not an internal code:** the account label changes from "AAC Agent 1fc50da1" to "All Agent Connect – [Agent Name]". This applies to new setups, and to existing ones through Bundle's documented team update if one exists.
- **Facebook "Choose Connection Type" screen:** no change for now. `withBusinessScope` is **not** added until I've confirmed that exact option in Bundle's current documentation, and that Standard Access still gives the Facebook Page posting permissions AAC needs. If I can't confirm both, I'll report back and leave it as is.

## Not changing
Posting, Hot Sheets, email, listing publishing, social defaults, sign-in security, the single final "Yes, Publish Listing".

## QA
- **Checks:** code checks, plus the publish review on a disposable Draft with Bundle stubbed. Stop at Go Back, then delete the Draft while it's still a Draft.
- **Nothing real during QA:** no real connect or disconnect, no publish, email, Hot Sheet event or social post.
- **The real test:** the end-to-end test on a rental happens only when you separately authorize it.
- **Report back:** exactly which Bundle options were confirmed and used.

## Technical details
- `SocialPlatformChoices`: one `Button` per platform (`outline` for Connect and Share, primary with a check for selected) and no status text. `onConnectRequest` is still first-publish only. The `AddListing` prefetch cache is reused.
- `social-connect-portal`: add an optional `platform` (validated against `PLATFORMS`). When it's given, use the single-platform connect-url if verified, otherwise the hosted portal with `socialAccountTypes: [platform]`. Add `logoUrl` (a public brand-assets URL), `hidePoweredBy: true` and back-button text. Use the agent's name for the team on create, and update existing teams only if a documented endpoint exists. No `withBusinessScope` without verification. Redeploy only this function.
- `openSocialConnectPortal(returnUrl, platform?)`: passes the platform through.
