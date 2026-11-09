# Listing Concierge — final email wording, links, and preview-fix note (2026-11-01)

Status: design approved by Chris Tuite. Nothing is deployed, activated, or sent. Reminders stay OFF until Chris gives explicit activation approval.

## Five emails (sender: All Agent Connect <hello@mail.allagentconnect.com>, AAC Unified template)

| # | Subject | Buttons → destination (all require sign-in; return URL preserved) |
|---|---|---|
| 1 Reminder | Is your listing at {{street_address}} still accurate? | Yes, It's Still Accurate → `/agent/listings/:id/confirm` · Update My Listing → `/agent/listings/:id/edit` (existing Edit Listing) · Let Our Concierge Handle It → `/agent/listings/:id/concierge` · Unsubscribe → per-recipient unsubscribe link |
| 2 Request confirmation | We received your update request for {{street_address}} | View Request → `/agent/concierge/:requestId/review` |
| 3 Staff new request | New concierge request: {{street_address}} ({{agent_name}}) | Open in Concierge Queue → `/admin/concierge` (admin only) |
| 4 Ready for review | Your listing changes for {{street_address}} are ready for review | Review & Approve → `/agent/concierge/:requestId/review` · Request Changes → same page, changes section |
| 5 Published | Your listing update for {{street_address}} is live | View Listing → `/property/:id` (signed-in view) |

Emails 1, 2, 4, 5 go to the agent plus each accepted assistant as individual copies, deduplicated by email, per-recipient unsubscribe respected. Email 3 goes to staff only. Links carry no access-granting token; the page checks authorization after sign-in.

## Form reuse
`/agent/listings/:id/concierge` reuses the existing Edit Listing status menu (same nine statuses, labels, validation), price/photos/property-detail fields and components. Only additions: Sold actual-transaction fields (closing date, final sale price, buyer-agent compensation actually paid: % / $ / none / unknown), optional files, and the "submit as request" step. No second editing system.

## Preview-crash fix
Superseded: held back from production and removed from the AAC project. See 04-final-instructions-2026-11-01.md and patches/vite-dedupe-preview-fix.diff (review only; apply only if needed).
