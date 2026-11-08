# AAC Concierge deep link — deployment handoff

**Review-only change. Not deployed. No emails, broadcasts or listings published.**

## What this adds
- Public, stable Facebook link: `https://allagentconnect.com/concierge`.
- Page explains the member-only concierge service and links signed-out agents to Login / Request Access.
- Verified agent form: request either a shareable property listing or a network broadcast; subject, optional address, details and reference URL.
- Private requests table `public.agent_concierge_requests`; RLS denies anonymous access and cross-agent reads. The form is NOT a send or publish button.
- Staff queue: `/admin/concierge-requests`, guarded to admins, with manual status changes.
- No cron, email jobs, public listing visibility, social posting, reminder changes or external providers.

This request queue is **separate** from the staged listing-update concierge functionality (`CONCIERGE_LISTINGS_ENABLED = false`). Do NOT enable that flag in this rollout.

## Required release order
1. Include the SQL migration in Nenad's isolated environment and verify that it applies cleanly against the current schema; this is a new table, not a modification of existing listing data.
2. Test client form and RLS end to end using fake agents/requests. Confirm the admin queue receives new submissions.
3. Test explicitly that submitting does not create a communication email, email_job, listing or Facebook post.
4. Coordinate deployment with the Nov 8–9 code freeze/cutover. **Do not merge/deploy mid-migration** without developer coordination.
5. Deploy migration to production **before** frontend. Confirm signed-out and verified-agent paths on live site.
6. Only after successful live smoke test, paste `https://allagentconnect.com/concierge` into Facebook announcement and group-feedback template.

## Acceptance checks
- Signed out: no form; sees only generic marketing copy and Login / Register buttons.
- Unverified / invited / suspended agent: cannot submit, even by direct REST insert.
- Verified **activated** agent: one request inserted with `status = new`, and a confirmation shown.
- Agent A cannot read Agent B's request, change status, or post through this form.
- Admin sees the request, agent identity, details, and can update status.
- Admin updates never send emails or publish listings.
- Existing success hub, listings, Hot Sheets, email delivery and migration work are unchanged.
- Link opens on desktop and mobile; signed-out form is not inadvertently shown during auth loading.

## Future enhancements (not required for this release)
- Safe photo/file upload with private storage and file size/type validation.
- Optional staff notifications (only with explicit activation approval).
- Draft-to-agent review handoff when the staged concierge-listing workflow is independently approved.

## Facebook announcement link
`https://allagentconnect.com/concierge` **after deployment and live verification only.**
