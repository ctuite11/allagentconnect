# AAC Concierge deep link — deployment handoff

**Review-only change. Not deployed. No emails, broadcasts or listings published.**

## What this adds
- Public, stable Facebook link: `https://allagentconnect.com/concierge`.
- Page explains the member-only concierge service and links signed-out agents to Login / Request Access.
- **Two distinct intake forms:** Property Listing is NOT an email. It collects address, property type, asking price, beds, baths, square feet, acres when Single Family, optional notes and up to 10 photos. Network Broadcast Email collects required Communications channel (Buyer Needs, Renter Needs, Sales Intel, General Discussion), email subject and message, optional reference URL.
- Listing requests store essential property data only in `agent_concierge_requests`. No published `listings` row or network broadcast is created. One staff-only notification is queued to **chris@allagentconnect.com** per new request.
- Property photos live in dedicated **private** bucket `concierge-request-photos`, not the public `listing-photos` bucket. Max 10 JPG/PNG/WebP files at 10 MB each. Each object path is scoped to submitting agent and intake request.
- Admin sees property details and short-lived signed photo previews in the private requests queue.
- Private requests table `public.agent_concierge_requests`; RLS denies anonymous access and cross-agent reads. The form is NOT a send or publish button.
- Staff queue: `/admin/concierge-requests`, guarded to admins, with manual status changes.
- No new cron, public listing visibility, social posting, reminder changes or external providers. Notification uses AAC's existing transactional `email_jobs` queue, not the Communications Center broadcast stream.

This request queue is **separate** from the staged listing-update concierge functionality (`CONCIERGE_LISTINGS_ENABLED = false`). Do NOT enable that flag in this rollout.

## Required release order
1. Include the SQL migration in Nenad's isolated environment and verify that it applies cleanly against the current schema; this is a new table, not a modification of existing listing data.
2. Test client form and RLS end to end using fake agents/requests. Confirm the admin queue receives new submissions.
3. Test that submitting creates exactly one idempotent admin-notification `email_jobs` row (fixed recipient `chris@allagentconnect.com`) but **no** Communications Center broadcast, listing, or Facebook post. Test confirmation popup on accepted request; test no success popup on failed insert.
4. Coordinate deployment with the Nov 8–9 code freeze/cutover. **Do not merge/deploy mid-migration** without developer coordination.
5. Deploy migration to production **before** frontend. Confirm signed-out and verified-agent paths on live site.
6. Only after successful live smoke test, paste `https://allagentconnect.com/concierge` into Facebook announcement and group-feedback template.

## Acceptance checks
- Signed out: no form; sees only generic marketing copy and Login / Register buttons.
- Unverified / invited / suspended agent: cannot submit, even by direct REST insert.
- Verified **activated** agent: one request inserted with `status = new`, one staff notification queued, and a confirmation popup shown. Closing the popup leaves an inline acknowledgement. If the notification cannot enqueue, the request insert must fail atomically.
- Agent A cannot read Agent B's request, change status, or post through this form.
- Broadcast request cannot be submitted without a valid channel; listing requests cannot carry a broadcast channel. The selected channel is shown in the admin queue.
- Listing request cannot be submitted without address, type, positive price and square feet, nonnegative beds/baths and lot acres for single family. Non-single-family requests have no acres field.
- Upload to private storage is restricted to the owner folder and a real owned new listing request. Admin can sign photo URLs; signed-out and other agents cannot access photos.
- Photos remain private until AAC staff review. If a photo upload fails, the request remains with a prominent warning to the submitting agent; staff can see whatever photos succeeded.
- Staff queue status updates never send emails or publish a listing. Only request **creation** queues a single fixed-recipient staff notification.
- Admin sees the request, agent identity, details, and can update status.
- Admin updates never send emails or publish listings. Delivery of queued staff notifications depends on AAC's existing email worker and its pause controls.
- Existing success hub, listings, Hot Sheets, email delivery and migration work are unchanged.
- Link opens on desktop and mobile; signed-out form is not inadvertently shown during auth loading.

## Current staff handoff limitation
- Staff can review the submitted details, photos and agent contact, and update request status. Turning the intake into an agent-owned listing draft is **not yet wired** to the queue; it requires the separate concierge listing functionality and explicit review/approval before any publication.

## Future enhancements (not required for this release)
- Safe photo/file upload with private storage and file size/type validation.
- Optional agent-facing confirmation email (not in this release).
- Draft-to-agent review handoff when the staged concierge-listing workflow is independently approved.

## Facebook announcement link
`https://allagentconnect.com/concierge` **after deployment and live verification only.**
