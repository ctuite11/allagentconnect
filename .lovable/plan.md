# Email footer: replace "Remove my account" with Manage preferences + Unsubscribe

## What's there today (audit)

- One shared shell, `buildAacEmail()`, renders every AAC branded email. Its dark footer contains a `mailto:` link labeled **"Remove my account"** (subject "Remove My Account"). It is *not* wired to any deletion endpoint — it just opens a mail composer to chris@allagentconnect.com. So removing it deletes no functionality.
- A separate `hideRemoveAccountLink` flag already suppresses that link for Hot Sheet-style alerts and development notifications; only some templates set it.
- A real unsubscribe footer line already exists but only renders when the sender passes a `tracking.unsubscribeUrl`, which today happens only for single-recipient "marketing category" sends.
- The sender currently attaches a blanket `List-Unsubscribe: <mailto:unsubscribe@allagentconnect.com>` header to **every** email, including password resets and activation links. That is exactly the transactional leakage this change should stop.
- Unsubscribes are stored in `email_unsubscribes` (email + category), written by the `email-unsubscribe` edge function and enforced at send time via the `is_email_unsubscribed` RPC. Signed HMAC links, GET confirmation page and RFC 8058 POST one-click are already implemented.

## Changes

### 1. Footer treatment (shared template)
Replace the "Remove my account" line with a two-link row, rendered only for subscription-style mail:

`Manage email preferences · Unsubscribe`

- "Remove my account" is deleted from the template entirely (all templates, transactional included). No deletion endpoint is touched or repurposed.
- The row renders only when the caller marks the email as subscription-style; transactional/security emails get the plain brand footer with no opt-out links.
- Styling stays identical to the current small muted footer text — no other design change.

### 2. Manage email preferences destination
Links to the Communications Center preferences area (`/communications`, deep-linked to the preferences section). Signed-in agents land directly on their channel/cadence controls; signed-out recipients hit the normal login gate and are returned there. This link is informational only — it never changes state by itself.

### 3. Unsubscribe behavior
- Uses the existing signed unsubscribe URL, carrying the email's own category, so it opts the recipient out of **that stream only** (e.g. hot sheet alerts stay separate from Communications Center broadcasts).
- The category list accepted by the unsubscribe endpoint is widened to cover the streams currently in use that it rejects today: Communications Center / buyer-need broadcasts, account reminders, member updates, and development notifications — plus the existing listing shares, hot sheet alerts, marketing, and "all".
- Stored as a row in `email_unsubscribes` (email + category, idempotent upsert). Every subsequent send in that category is suppressed before the provider call.

### 4. List-Unsubscribe headers
- Subscription/bulk categories get both `List-Unsubscribe` (one-click URL + mailto) and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- The blanket mailto header is removed from the default path, so transactional/security mail carries **no** unsubscribe headers.

### 5. Category classification

Subscription-style — footer links + headers + suppression:
hot sheet alerts, Communications Center broadcasts and digests, buyer-need / client-need notifications, marketing and member updates, agent activation nudges / reminders, development notifications, listing shares.

Transactional / security — no footer links, no headers, no suppression:
password reset, account activation and setup links, temp-password and login-link email, license verification and verification-submitted notices, developer approval/setup, admin operational alerts, showing requests and direct agent-to-agent or agent-to-client 1:1 messages.

## Verification before deploy
Rendered HTML snapshots for one subscription template and one transactional template, plus the existing golden-file email tests, to confirm the footer and headers appear only where intended.

## Sending
No test, preview, or production email will be sent, and edge functions will not be deployed until you approve this plan.
