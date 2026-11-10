# AAC Privacy Lockdown

Privacy lockdown restricts access to AAC listings, agent information and
confidential media. External listing access requires explicit authorization and
a valid share link, authenticated Hot Sheet membership, or an eligible DCMLS
publication.

## Release status

| Area | Status |
|---|---|
| Base privacy migration, `20261110120000_privacy_lockdown.sql` | Applied; do not reapply |
| Workflow repair migration, `20261110143000_privacy_workflow_repairs.sql` | Validated locally; not applied to destination |
| Access boundary migration, `20261110160000_privacy_access_boundary_fixes.sql` | Validated locally; hosted execution pending |
| Application and backend functions | Deployment verification required |
| Private Storage configuration and CDN clearance | Verification required |
| Hosted acceptance checks | Required before release |
| Email, notifications, cron and social publishing | Keep paused until separately approved |

The base migration remains applied. Both follow-up migrations are prerequisites
for the corresponding backend and application release. Apply any outstanding
follow-up in timestamp order; retain migrations already applied. No hosted SQL
has been executed during local validation.

## Privacy controls

| Area | Implemented behavior |
|---|---|
| Network access | Database permissions, restrictive RLS and backend authorization restrict listings and directory information to authorized accounts |
| External sharing | Disabled by default; the listing agent records seller authorization and marketing restrictions |
| Listing links | Single-listing scope, hashed tokens, expiry, revocation and atomic replacement |
| Buyer contact card | Sharing agent or Hot Sheet owner, labelled Your Agent / Shared by |
| Unavailable links | Neutral page and generic previews, without property or agent details |
| Hot Sheets | Recipient-bound invitations, valid token or authenticated membership, and approved matches only |
| Buyer property details | Full property sections, favorites, showing requests and messaging within authenticated membership scope |
| DCMLS | Only seller-authorized, published listings from visible, verified participating agents |
| Confidential media | Private Storage access and authorized, short-lived signed URLs |
| Email | Neutral property imagery, secure page links and current-permission checks before delivery |
| Price alerts | Internal service authentication, current favorite and recipient scope, and permission checks before queueing and delivery |
| Inquiry persistence | Authorized server handlers only; direct browser inserts denied |
| Profile correspondence | Verified network authority or verified public DCMLS intake; server-resolved agent recipients and enforced rate limits |
| Replacement requests | Authenticated, throttled in-app request with review and acknowledgement in the sharing account |
| Public search and previews | Marketing-only sitemap and generic private-page metadata |
| Seller intake | Rate-limited aggregate matching without exposing agent records |

## Documentation

- [Privacy policy and access requirements](05-decisions-and-public-function-review.md)
- [Technical implementation](06-implementation-and-release.md)
- [Database function access](07-effective-function-access.md)
- [Release readiness and operational checks](08-release-runbook.md)
- [Validation and acceptance status](validation-results.md)

## Operational requirements

Existing listings retain external sharing disabled until the listing agent
records authorization. Buyer results may therefore remain empty for listings
that have not been approved.

Complete the remaining application, backend, Storage and acceptance checks in
the release runbook. Keep copied-user communications and all scheduled delivery
paused throughout migration verification.
