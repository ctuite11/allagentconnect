# Validation and Acceptance Status

## Database status

The base privacy migration, `20261110120000_privacy_lockdown.sql`, is applied
and remains unchanged. The separate workflow repair migration,
`20261110143000_privacy_workflow_repairs.sql`, and access boundary migration,
`20261110160000_privacy_access_boundary_fixes.sql`, have passed local validation.
No hosted migration has been executed during this work. Apply only outstanding
follow-ups in timestamp order before the backend and application release.

## Code validation

| Area | Recorded result |
|---|---|
| Application behavior | 295 tests passed across 47 files |
| Database privacy controls | 32 tests passed against the destination schema with fake records |
| Backend endpoints | 32 offline tests passed with mocked providers |
| Outbound safety controls | 40 tests passed |
| Private Storage helper | 5 tests passed |
| Security guard | Passed |
| Profile contact component lint | Passed |
| Application bundle compilation | Passed using an offline destination-lock fixture; the real destination release-build check remains required |
| Type verification | No additional errors; four existing Supabase generated-type overload errors remain |
| Legacy migration configuration tests | Three target-reference expectations require alignment with the configured destination |
| Browser presentation | Browser execution unavailable in the local environment; deployed desktop/mobile acceptance remains required |
| Hosted Auth, Storage and CDN acceptance | Environment verification required |

These results establish code-level coverage. They do not certify deployment
configuration, live Storage permissions, provider cache propagation or hosted
browser behavior.

Type verification still reports the existing insert/update overload errors in
`CreateBuyerDialog.tsx`, `ListingChatDrawer.tsx`, `syncHotSheetCommentPreview.ts`
and `ManageListingPhotos.tsx`. Full project type verification is therefore not
recorded as passing.

## Verified functional areas

- Anonymous table and column access, public function allowlists and future
  permission defaults.
- Account verification, hidden-directory behavior, administrator moderation
  and accepted delegate scope.
- Default-off external sharing, listing-agent authorization and protected
  link creation, replacement, expiry and revocation.
- Recipient-bound Hot Sheet access, safe listing responses and authorization
  independent of editable profile email.
- Denied self-assignment of representation, rejected foreign CRM activation,
  rejected existing forged relationships and preserved intended-recipient activation,
  including account binding across a subsequent Auth email change.
- Database denial of direct inquiry/showing inserts and retained authorized
  service persistence.
- Actual-recipient price alerts, favorite and membership rechecks, seller approval
  generation checks, neutral imagery and scoped authenticated property links.
- Network and DCMLS profile correspondence, enforced rate limits, deliberate admin
  outreach, backend rejection handling and verification-token requirements.
- Verified-agent favorites sharing through the existing secure bulk handler;
  legacy client-authored payloads and obsolete queued jobs refused.
- Workspace-only invitation acceptance without implicit Hot Sheet membership;
  recipient, ownership, expiry and revocation checks.
- Saved Hot Sheet ZIP, status, property code, city/neighborhood and overlapping
  price-range criteria across listing and photo authorization.
- Full authenticated buyer details, favorites, showing and messaging actions,
  return navigation and membership checks for emailed Hot Sheet listings.
- Sharing-account replacement-request review, explicit acknowledgement,
  account-context isolation and recovery from loading/submission failures.
- DCMLS listing, profile, comparison and media access requiring publication,
  participation, seller authorization, verification and directory visibility.
- Server-authorized inquiries and showing requests, sharing-agent recipient
  selection for AAC buyers and separate fixed-destination support delivery.
- Scoped photo signing, neutral previews, marketing-only sitemap and protected
  legacy endpoints.
- Current-permission checks for listing email, neutral property imagery and
  buyer-safe agent attribution.
- Audited draft publishing, retained listing numbering and no-contact controls.
- Read-only deployment verification and emergency external-access disablement.

The base privacy migration, public homepage, About page, marketing sitemap and
SEO metadata are unchanged by these workflow repairs. No hosted migration,
copied-user communication, notification delivery or scheduled work was executed
during validation.

## Release acceptance

Complete the environment checks in the [release runbook](08-release-runbook.md),
including the standard build's destination-lock check, deployed endpoint
behavior, private/public media URLs, original and transformed CDN caches,
dedicated account scenarios and mobile presentation.

Keep email, notifications, cron and social publishing paused throughout
migration acceptance. External sharing remains disabled for listings without
recorded authorization.
