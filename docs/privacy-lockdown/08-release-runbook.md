# Release Readiness and Operational Checks

## Current state

The base privacy migration, `20261110120000_privacy_lockdown.sql`, is applied.
Keep it unchanged and do not reapply it. The separate workflow repair migration,
`20261110143000_privacy_workflow_repairs.sql`, has passed local validation and
requires destination application before the corresponding application release.
The access boundary migration, `20261110160000_privacy_access_boundary_fixes.sql`,
adds the recipient, persistence and price-alert restrictions. Neither follow-up
has been executed against a hosted database during local validation. Retain any
follow-up already applied to the destination.

The remaining activities are outstanding privacy follow-up migrations, backend and application deployment verification,
private Storage verification, CDN clearance and hosted acceptance. Complete
these activities in the migration environment, project `kwfqjnepesiihjkdnxou`.

Keep the live source environment unchanged during migration. Email workers,
Hot Sheet, Communications Center and development notifications, cron jobs and
social publishing must remain paused until separately approved. Use dedicated
test accounts and recipients for acceptance checks.

## Remaining release actions

### 1. Confirm environment readiness

Confirm that application settings, backend deployment and Storage operations
all target the migration project. Verify object completeness for listing
photos, floor plans and documents before the media cutover.

Maintain restricted preview access during deployment. Confirm the existing
no-contact status using the read-only query:

```sql
SELECT public.migration_no_contact_status();
```

Required values are `database_locked = true`, no active cron jobs, no active
HTTP triggers, no queued HTTP requests, no unguarded network routines and no
changed quarantined routines.

### 2. Apply outstanding privacy follow-up migrations

Apply any outstanding follow-up in timestamp order in the destination SQL Editor
as `postgres`, or through the existing migration pipeline:

1. `supabase/migrations/20261110143000_privacy_workflow_repairs.sql`, if not already applied.
2. `supabase/migrations/20261110160000_privacy_access_boundary_fixes.sql`.

Execute each complete transaction. The access boundary migration requires the
preceding privacy schema and preserves the delivery lock and private bucket
settings. Do not rerun an already-applied migration.

Confirm the destination before execution. If the transaction reports an
unexpected DCMLS column or missing prerequisite, resolve the schema discrepancy
before proceeding. Do not remove the privacy checks or expose additional columns
to complete deployment. Recheck `migration_no_contact_status()` afterwards.

The activation overload is recreated without an overlapping default argument.
An unexpected external dependency aborts the transaction; review it before
proceeding and do not add `CASCADE`. The permission timestamp advances on each
authorization change so a renewed approval cannot revive an old price alert.

Do not run `apply-in-migration.sql` or reapply the base privacy migration as part
of this release. Retain those files for schema history and fresh-environment
validation.

### 3. Verify backend deployment

Deploy or verify the backend functions through the existing migration pipeline.
The release includes the authorized media endpoint `shared-listing-photos` and
the aggregate-only intake endpoint `agent-match-count`, together with the
protected listing, preview, inquiry and notification handlers. Include
`send-showing-request-email`, `send-contact-email` and `dcmls-compare-agents`.
Include `send-agent-profile-contact`, `send-favorites-share` and
`send-price-change-notification`. Favorites sharing also requires the existing
authorized `send-bulk-listing-share` handler. Deploy the profile contact form
with its DCMLS verification support and backend error handling.
Redeploy the email workers and any other function that bundles the shared email
authorization helpers so listing-inquiry and showing templates use the current
delivery checks.

Retain the endpoint configuration in `supabase/config.toml`. Keep migration
and delivery-pause flags enabled.

Price-alert production accepts only the existing internal service credential.
An ordinary user or public key cannot invoke it. Any later approved scheduler
must use the protected internal invocation pattern; leave cron disabled during
migration acceptance.

### 4. Complete private media configuration

Check the confidential bucket settings:

```sh
python scripts/security/privacy-storage.py --check
```

If private-bucket cutover is still outstanding, use the Storage API helper:

```sh
python scripts/security/privacy-storage.py --apply
python scripts/security/privacy-storage.py --check
```

Enter the destination service credential only at the hidden local prompt.
The helper changes the four confidential bucket flags, preserves object paths,
MIME and file-size restrictions, and requests original and transformed CDN
cache clearance. It does not copy or delete objects. Keep existing private
document buckets private and retain public branding access.

If cache clearance is incomplete, keep the preview restricted and delivery
paused. Resolve the provider/CDN issue and verify anonymous URLs before release.
Confidential buckets must remain private throughout.

### 5. Verify the application release

Build and deploy the application and Netlify configuration using destination
public credentials and the existing migration-lock settings. The standard
build must pass its destination no-contact status check.

Confirm private media, sharing authorization, link management, buyer access,
neutral unavailable pages and generic metadata on the deployed application.
Existing listings remain external-sharing disabled until their listing agents
record authorization. Do not bulk-enable sharing from listing status or past
communications.

### 6. Run read-only verification

Run `verify-in-migration.sql` in the destination SQL Editor as `postgres` after
the application, backend and Storage checks. This verification does not reapply
the migration or change database state.

Expected result:

`PRIVACY_CATALOG_AND_STORAGE_FLAGS_PASS_DELIVERY_STILL_LOCKED`

The check covers anonymous function and column access, internal permissions,
private bucket flags, restrictive Storage policies and the no-contact lock.
Record the applied destination schema through the existing snapshot workflow
before merging migration changes; the schema-drift PR check requires an updated
schema snapshot.

## Acceptance matrix

Use dedicated test accounts. Replacement-link requests must target a test
sharing agent so that copied users receive no in-app notification.

| Area | Required result |
|---|---|
| Signed-out listing-ID and directory access | Neutral/unavailable result without private records or metadata |
| Anonymous database access | Eleven allowed RPCs; static county data and publication-filtered DCMLS view only |
| Invited, unverified, restricted and buyer accounts | No broad listing or directory access; permitted own-account functions remain available |
| Verified agents, delegates and administrators | Authorized account and moderation workflows remain available |
| Hidden directory profiles | Hidden from other agents; accessible within permitted own/admin context |
| Seller authorization | Default off; only the listing agent can record approval |
| Create, revoke and replace links | Single-listing scope, correct sharing-agent card, bounded expiry and invalidation of superseded links |
| Expired, revoked or ineligible access | No listing details, contact card or fresh media signature |
| Seller opt-out and subsequent opt-in | Existing listing links remain revoked; new links require current authorization |
| Hot Sheets, previews, favorites and buyer map | Only approved matches within the authorized token/member scope |
| Hot Sheet criteria | Exact/partial ZIP, explicit status selection, property codes, city/neighborhood and overlapping price ranges agree with the saved criteria |
| Buyer property page | Full property sections, favorites, showing, messaging and correct Hot Sheet return context; sharing-agent card only |
| Emailed Hot Sheet listing | Full page for authenticated members; bearer access alone retains the scoped read-only viewer |
| Workspace-only invitation | Intended recipient can accept without a Hot Sheet; other accounts cannot accept; no implicit sheet association |
| Replacement requests | Visible only to the sharing account; explicit acknowledgement; no automatic replacement or delivery |
| Public DCMLS | Publication, participation, seller authorization, visibility and verification all required; opt-out removes results, contacts, comparisons and fresh media signatures |
| Inquiry/showing recipient | Resolved server-side; AAC buyer showings go to the sharing agent; private listing IDs cannot enter the public inquiry path |
| Recipient identity | Profile-email edits cannot establish another buyer's membership |
| Relationship writes and activation | Buyers cannot self-create representation; known foreign CRM IDs, forged rows, revoked invitations and both activation overloads grant no unauthorized access |
| Direct inquiry/showing writes | Authenticated browser inserts are denied; authorized service handlers still save requests |
| Price alerts | Current favorites and recipient scope only; no pre-approval buyer history; neutral imagery and authenticated page links |
| Price-alert delivery | Removed favorites/membership, changed Auth email, seller opt-out and renewed approval invalidate stale jobs |
| Profile messages | Known network recipients, approved public DCMLS intake and authorized admin outreach work; limiter errors and SDK failures show failure |
| Favorites sharing | Verified-agent listing-ID requests use approved expiring links; client-authored properties and arbitrary URLs cannot authorize mail |
| Draft publishing and Hot Sheet lifecycle | Existing validation, audit and explicit invitation rules remain effective |
| Confidential photos, floor plans and files | Authorized private media loads; anonymous public URLs return no confidential bytes |
| Branding and local upload previews | Headshots, logos, brand assets and permitted previews remain available |
| Previews, sitemap and indexing | Generic private-page previews, marketing-only sitemap and correct indexing headers |
| Legacy privileged endpoints | Private lookup and enrichment branches require authorized caller scope |
| Seller intake | Bounded aggregate matching with no agent records returned |
| Final operational state | Delivery paused and database no-contact status intact |

## Email and public-media requirements

Property email imagery is neutral. Buyers open an authorized page for property
photos; reusable buyer tokens are excluded from image URLs. Listing-bearing
mail requires current permission at enqueue and delivery.

Pending listing jobs require review and current links before workers are
released. Jobs with obsolete authorization must not be replayed automatically.
This includes legacy `favorites-share` and `price-change-notification` jobs
without current permission contracts. Do not remove worker checks to release
those jobs. Buyer price-history rows predating the current seller approval are
excluded from automatic alerts.
Conversation mail retains the authored message and conversation link while
restricting automatic property cards to verified agent recipients.

Public access to confidential media ends at cutover without a grace period.
Images embedded in previously sent email may stop displaying. Signed URLs
request 600 seconds, but downloaded copies and browser/CDN caches may persist.
Check previously cached original and transformed URLs as well as fresh requests.

Destination Storage settings do not revoke URLs served by a different origin.
Legacy public origins and separate CDN caches require their own coordinated
production cutover. Keep live-source permissions unchanged during migration.

## Recovery and release approval

Retain database restrictions and private bucket settings during application
recovery. Do not restore broad PUBLIC grants or public confidential-media access.

`emergency-disable-external.sql` is an incident-response control, not a routine
release step. It disables external listing eligibility while retaining agent
network access, authorization records and delivery controls. Restoration requires
an approved repair and verification. Potentially compromised links require
separate review.

Completing migration acceptance does not authorize production traffic, copied-user
communications, cron activation or social publishing. Those releases require
separate approval.
