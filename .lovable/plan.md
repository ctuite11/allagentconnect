# Social publishing: clearer words, a Settings home, and an explainer before connecting

## The confusion
Right now two different things look like the same "connection":
- **Profile social links**: the Facebook and other links on your AAC profile. They only tell people where to find you.
- **Publishing connection**: permission for AAC to post listings for you. You grant it through Bundle's secure sign-in page.

A link on your profile never counts as a publishing connection, and nothing in this plan changes that.

## What changes

### 1. Publish review rows ("Ready to publish?")
Each row changes to this:

```text
[ ] Facebook                               [Connect]
    Not connected for publishing
```
- **Connected rows:** the checkbox works and the row says "Connected for publishing". No button.
- **Not connected rows:** the checkbox stays off and a small **Connect** button appears on the right. Clicking the row name no longer starts connecting. Only the button does.
- **While checking:** rows show "Checking…". If the check fails they show "Status unavailable". Same as today, and the box doesn't move.
- **The later "Share this update?" box** only adopts the new wording "Not connected for publishing". It gets no Connect button.

### 2. A short explainer before Bundle opens
Clicking **Connect** in the publish review first opens a small AAC box:

> **Connect social media for publishing**
> All Agent Connect uses Bundle to securely connect your social accounts for listing publishing. Your profile social links are separate and do not provide publishing permission.
> [Cancel] [Continue to Connect]

- **Cancel:** you're back in the review, nothing saved and nothing changed.
- **Continue to Connect:** the existing flow runs. It saves the Draft, opens Bundle in the same tab, comes back and reopens the review. Still no publishing without your final "Yes, Publish Listing".
- **After you connect:** the statuses refresh, and a newly connected platform shows "Connected for publishing" but stays **unchecked**. You have to tick it yourself before publishing.

### 3. New "Social Publishing" section in Settings
This replaces today's "Social Media" pointer card in Settings.

> **Social Publishing**
> Connect your social accounts to publish listings directly from All Agent Connect. These connections are separate from the social links displayed on your profile.

- **Four rows:** Facebook, Instagram, LinkedIn and Threads, each showing Connected or Not connected. They show "Checking…" while loading.
- **One button:** **Connect accounts** when nothing is connected (Bundle's page manages all four networks), **Manage connections** once at least one is connected. It goes through the same explainer box, then Bundle, then back to Settings.
- **Link to profile links:** a line underneath reads "Looking for the social links on your profile? Edit them on your Profile," with the existing link.
- **Accounts without access:** while social publishing is limited to the launch group (admins today), accounts without access see only that Profile line, not the publishing rows.

Profile stays links-only (six links), as agreed before.

## Not changing
Bundle sign-in, posting, social defaults, the publish flow and its single final confirmation, photo rule, Hot Sheets, email, DCMLS. Profile links are never treated as publishing connections.

## QA (no real publish or post, Bundle portal stubbed)
- **Publish review:** rows show the new wording and a Connect button. Connect opens the explainer; Cancel returns with no save. Continue saves the Draft, makes the stubbed round-trip and reopens the review. Facebook stays unchecked.
- **Settings:** the section shows four rows. Connect or Manage opens the explainer, and Continue comes back to Settings. The Profile link works.
- **Clean-up:** the fake Draft is deleted while still a Draft, with no history, Hot Sheet, email or social records. Checked on desktop and mobile. "Yes, Publish Listing" is never clicked.

## Technical details
- `SocialPlatformChoices`: status text becomes "Connected for publishing" / "Not connected for publishing" under the label. When `onConnectRequest` is set, a disconnected row gets a small outline **Connect** `Button` and its checkbox is disabled. The update prompt (no `onConnectRequest`) just uses the new wording.
- New `ConnectSocialExplainerDialog` (Cancel / Continue). `AddListing.tsx` sets a pending platform on Connect and runs the existing `handleConnectFromReview(p)` only on Continue.
- `SocialMediaSettingsCard` is rewritten as "Social Publishing". It uses `fetchSocialConnected()`; null means only the Profile line shows. Connect/Manage go through the explainer, then `openSocialConnectPortal(`${origin}/agent/settings`)`. No new backend, and the `social-connect-portal` / `social-accounts-status` functions are reused unchanged.
