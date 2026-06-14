## Goal

On the in-app Agent Profile page, the email row currently opens the OS mail client via `mailto:`. Switch it to the AAC in-app email composer (same flow as the "Email {First}" button), and change the email icon color to AAC primary blue.

## Changes

**File: `src/pages/AgentProfile.tsx`**

1. In the `profileContactRows` array, replace the email row's `href: mailto:` with an `onClick` action that opens the existing `ContactAgentProfileDialog` (the AAC email system). The phone rows continue to use `tel:` links unchanged.

2. Render the contact list to support either an `<a href>` (phone) or a `<button onClick>` (email), so the email row triggers the AAC dialog with `agent`, `viewerSender`, and prefilled subject — same props already used by the "Email {First}" button below.

3. Color the email row's `Mail` icon with `text-aac` (AAC primary blue token) instead of `text-neutral-400`. Phone/website icons keep their neutral color.

Public mode (`/agent/:code`) is unaffected — `showListingAgentEmail` already gates that, and the public view will simply not show the email row when not authenticated. The "Email {First}" CTA button below is unchanged.

## Out of scope

- No backend / email-system changes (ContactAgentProfileDialog already routes through the AAC email queue).
- No changes to AgentProfileHeader or PublicAgentProfile.
- No layout, copy, or other styling changes.
