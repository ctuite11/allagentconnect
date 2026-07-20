## Goal

Add a new admin-triggered email template — "Too many emails? We've got you covered." — that walks verified agents through managing their Communications Center preferences, with the 3 annotated screenshots embedded inline.

## Approach

Send from inside AAC using the existing admin broadcast/outreach flow (same pattern as other verified-agent blasts). Audience: verified agents (per current eligibility rules: verified AND (activated OR has_headshot)).

## Steps

### 1. Upload the 3 screenshots to Lovable Assets
- `comms-channels.png` — Channels toggles overview
- `comms-coverage.png` — Coverage Area setup
- `comms-timing.png` — Notification timing options

These become stable CDN URLs safe to reference from email HTML (email clients can't load `/src/assets`).

### 2. New email template
Create `supabase/functions/_shared/emailTemplates/commsCenterGuide.ts`:
- Uses the AAC Unified email shell (white bg, brand header, dark footer with unsubscribe — same as other transactional/marketing emails).
- Subject: **"Too many emails? We've got you covered."**
- Preheader: "A 30-second tour of your Communications Center."
- Body copy (cleaned up from your draft):
  - H1: "Too many emails? We've got you covered."
  - Intro: "Head over to your Communications Center and follow these simple steps to stop the madness."
  - **Step 1 — Turn channels on or off.** Screenshot 1. "Toggle Buyer Needs, Renter Needs, Sales Intel, and General Discussions based on what you actually want to hear about."
  - **Step 2 — Set your coverage area.** Screenshot 2. "Narrow alerts to a state, county, specific towns, or even a single neighborhood."
  - **Step 3 — Choose your cadence.** Screenshot 3. "Immediately, Daily digest (6 PM ET), or Weekly digest (Friday 6 PM ET)."
- Primary CTA button → Comms Center Preferences page (`/comms-center/preferences` — confirm exact route during build).
- Category: `marketing` so the standard one-click unsubscribe + suppression logic applies.

### 3. Register template in the email registry
Add `comms_center_guide` to the `TEMPLATES` map used by `send-transactional-email` so it can be dispatched by name.

### 4. Admin trigger UI
Add a new tile/button in the existing Admin broadcast surface (same page you already use to send verified-agent blasts) labeled **"Send Comms Center Guide"**:
- Confirmation dialog showing recipient count (verified agents eligible per shared audience helper).
- On confirm, calls the existing bulk-enqueue path (reusing `verifiedAgentAudience.ts` + `email_jobs` queue). No new backend endpoint needed if we reuse the existing broadcast Edge Function; otherwise a thin wrapper.
- Respects `suppressed_emails` and per-user unsubscribe on `marketing` category automatically via the shared send path.

### 5. Send test to self first
Include a "Send test to me" button so you can preview in your own inbox before the full broadcast.

### 6. Deploy
Redeploy the affected edge functions (`send-transactional-email` and whichever admin broadcast function we extend).

## Technical notes

- Screenshots embedded as `<img src="{cdn-url}" width="600" style="max-width:100%;...">` — no attachments, no CID.
- Email width capped at 600px; images scale down on mobile.
- Screenshots will be resized to ~1200px wide (2x for retina) before upload to keep the email under Gmail's 102KB clipping threshold.
- No schema changes. No new tables. No changes to unsubscribe logic.
- No changes to Comms Center preferences UI itself.

## Out of scope

- Changing existing preference UX or copy.
- Scheduling/automating this email — it's a one-shot admin-triggered blast.
- Non-verified agent audiences.