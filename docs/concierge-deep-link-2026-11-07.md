# AAC Concierge deep link — deployment handoff

**Review-only change. Not deployed. No emails, broadcasts or listings published.**

## What this adds
- Public, stable Facebook link: `https://allagentconnect.com/concierge`.
- Page explains the member-only concierge service and links signed-out agents to Login / Request Access.
- **Two distinct intake forms:** Property Listing is NOT an email. It collects address, property type, asking price, beds, baths, square feet, acres when Single Family, optional notes and up to 10 photos. Network Broadcast Email collects required Communications channel (Buyer Needs, Renter Needs, Sales Intel, General Discussion), email subject and message, optional reference URL.
- Listing requests store essential property data only in `agent_concierge_requests`. No published `listings` row or network broadcast is created. One staff-only notification is queued to **chris@allagentconnect.com** per new request.
- Property photos live in dedicated **private** bucket `concierge-request-photos`, not the public `listing-photos` bucket. Max 10 JPG/PNG/WebP files at 10 MB each. Each object path is scoped to submitting agent and intake request.
- Admin sees property details and short-lived signed photo previews in the private requests queue; the first three load as thumbnails and **View all submitted photos** signs the rest only on demand.
- Private requests table `public.agent_concierge_requests`; RLS denies anonymous access and cross-agent reads. The form is NOT a send or publish button.
- Staff queue: `/admin/concierge-requests`, guarded to admins, with manual status changes.
- **Request → draft handoff:** `Create agent draft` uses the NEW isolated admin-only `admin-create-concierge-request-draft` function with the intake request ID. The server checks request identity and agent membership, copies essentials from the private intake, creates a member-owned listing in `draft` status, and marks the intake `in_progress`. This is a separate endpoint to prevent a preview pointing at the old backend from accidentally creating a blank production listing.
- `Continue agent draft` opens the existing Add Listing editor in request-only admin draft mode at `/admin/concierge-requests/edit/:id`. `CONCIERGE_LISTINGS_ENABLED` remains **false**; no older concierge surfaces are enabled.
- Private submitted photos stay in the **intake** queue. The listing-photo storage is not confirmed private, so photos are NOT copied to a public listing storage bucket; staff must review them and wait for the privacy-safe transfer flow. The existing Add Listing photo upload/management controls are disabled for request-linked draft editing to prevent staff from accidentally uploading private images into public storage.
- **Explicit agent review stage:** For a request-backed agent draft without unresolved private photos, Admin → Concierge Requests offers **Send to agent for review** with a confirmation dialog. The new, isolated JWT-protected `admin-send-concierge-request-review` endpoint uses AAC's existing tokenized review-email mechanism only on that explicit click after server-side checks for ownership, a complete listing address and essentials, and no pending private photos. The agent-only `/agent/listings/review/:id` route is now enabled solely for a matching request-backed concierge draft, without enabling legacy concierge UI.
- Private submitted photos can be reviewed by the agent via short-lived authenticated signed URLs, but **do not appear as published listing photos**. The Review page disables publishing while photos are pending, and a narrowly scoped database trigger also blocks any draft→live status change for such a listing (including alternate navigation paths). No photo URLs are inserted into outgoing emails.
- No new cron, public listing visibility, social posting, reminder changes or external providers. Only the original staff request notice and explicitly clicked agent review email use AAC's existing transactional `email_jobs` queue; neither is a Communications Center broadcast.

This request queue is **separate** from the staged listing-update concierge functionality (`CONCIERGE_LISTINGS_ENABLED = false`). Do NOT enable that flag in this rollout.

## Required release order
1. Include the SQL migration in Nenad's isolated environment and verify that it applies cleanly against the current schema; this adds one new requests table and a unique index on the existing listings creation_request_id column. Review for any legacy duplicate request IDs before applying.
2. Test client form and RLS end to end using fake agents/requests. Confirm the admin queue receives new submissions.
3. Test that submitting creates exactly one idempotent admin-notification `email_jobs` row (fixed recipient `chris@allagentconnect.com`) but **no** Communications Center broadcast, listing, or Facebook post. Test confirmation popup on accepted request; test no success popup on failed insert.
4. Deploy the NEW `admin-create-concierge-request-draft` endpoint in isolated staging ONLY. Test Create agent draft, Continue draft, staff Save Draft, repeated/concurrent creates, ownership, and server-only prefill. Confirm one `listings` record per request, owned by the agent, status `draft`, with no public photos or network emails. Test that the preview against the old backend fails harmlessly instead of calling the old creator.
5. Test agent-owned review page, short-lived photo URLs and account scoping. With private submitted photos, the review email MUST be blocked before creating tokens/jobs and all listing publication paths MUST be blocked at DB level. Without pending photos, a fully completed draft permits an admin-confirmed review email **only** and never publishes automatically. Verify the preview against the OLD backend cannot invoke this missing new endpoint (no real emails). Run server readiness unit tests.
6. **Schema Drift Check currently fails** because the migration changed without regenerating `docs/database/schema_snapshot.sql`. Generate the snapshot in Nenad's migrated staging DB after applying the tested SQL; don't copy a production snapshot or fabricate one to satisfy CI.
7. Coordinate deployment with the Nov 8–9 code freeze/cutover. **Do not merge/deploy mid-migration** without developer coordination.
8. Deploy migration to production **before** frontend. Confirm signed-out and verified-agent paths on live site.
9. Only after successful live smoke test, paste `https://allagentconnect.com/concierge` into Facebook announcement and group-feedback template.

## Acceptance checks
- Signed out: no form; sees only generic marketing copy and Login / Register buttons.
- Unverified / invited / suspended agent: cannot submit, even by direct REST insert.
- Verified **activated** agent: one request inserted with `status = new`, one staff notification queued, and a confirmation popup shown. Closing the popup leaves an inline acknowledgement. If the notification cannot enqueue, the request insert must fail atomically.
- Agent A cannot read Agent B's request, change status, or post through this form.
- Broadcast request cannot be submitted without a valid channel; listing requests cannot carry a broadcast channel. The selected channel is shown in the admin queue.
- Listing request cannot be submitted without address, type, positive price and square feet, nonnegative beds/baths and lot acres for single family. Non-single-family requests have no acres field.
- Upload to private storage is restricted to the owner folder and a real owned new listing request. Admin can sign photo URLs; signed-out and other agents cannot access photos.
- Photos remain private until AAC staff review. If a photo upload fails, the request remains with a prominent warning to the submitting agent; staff can see whatever photos succeeded.
- Staff queue status updates never send emails or publish a listing. Request creation queues one fixed-recipient staff notification. Only an explicit, confirmed `Send to agent for review` click can queue an agent-review email; it performs server-side readiness checks before any tokens or jobs are created.
- Admin sees the request, agent identity, details, and can update status.
- Admin updates never send emails or publish listings. Delivery of queued staff notifications depends on AAC's existing email worker and its pause controls.
- Request-based draft creation must reject agent ID mismatch, invalid or non-listing request, closed request, or ineligible agent.
- A second click (including simultaneous clicks) must reuse the same draft; a unique partial index on `listings.creation_request_id` enforces this at the database layer.
- The draft editor saves through the admin-only draft API and cannot publish. No listing alerts or network emails are generated by draft creation.
- Unresolved private intake photos block review-email queueing and listing publication. A DB trigger applies only to member-owned concierge request drafts on a draft→live status transition; unrelated listings are unaffected.
- Existing success hub, listings, Hot Sheets, email delivery and migration work are unchanged.
- Link opens on desktop and mobile; signed-out form is not inadvertently shown during auth loading.

## Current staff handoff limitation
- The queue can now create or continue a request-linked, agent-owned draft and open it in AAC's existing listing editor. Only the agent can publish.
- **Still blocked:** private intake photo transfer into the listing while storage privacy is unverified. Do not bypass the hold or copy signed temporary URLs to `listings.photos`.
- The agent-review email is wired via a **new isolated endpoint**, but remains **undeployed and untested**. It is manual and cannot be sent for photo-pending requests; the legacy sender has not been changed or called. Review emails must be tested against a fake email sink in isolated staging before enabling it.

## Future enhancements (not required for this release)
- Safe photo/file upload with private storage and file size/type validation.
- Optional agent-facing confirmation email (not in this release).
- Privacy-safe transfer of submitted photos into the agent's listing, followed by removal of the narrowly scoped DB publication gate once verified.

## Facebook announcement link
`https://allagentconnect.com/concierge` **after deployment and live verification only.**
