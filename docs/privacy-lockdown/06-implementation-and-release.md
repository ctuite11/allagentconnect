# Privacy Lockdown Technical Implementation

The code base provides database authorization, controlled external sharing,
private media access and protected public endpoints. The database privacy
migration has been applied. The workflow repair migration is a separate database
prerequisite. The access boundary migration provides recipient and persistence
authorization and price-alert permission checks. Application deployment and environment acceptance
are covered in the [release runbook](08-release-runbook.md).

## Database authorization

Anonymous access uses an explicit allowlist. Table permissions, column
permissions, views, restrictive RLS and RPC authorization control access to
network data. Internal function implementations and permission records reside
in the unexposed `aac_privacy` schema with API access revoked.

Authenticated access retains the permissions required for authorized agent,
delegate, administrator and owner workflows. Listing-number generation and the
audited draft-publishing flow remain available. Owner-scoped seller submission
access is retained.

Directory reads enforce visibility and verification rules. Hidden agents retain
access to their own profiles, administrators retain moderation access, and
Communications Center opt-in remains separate from directory visibility.

System actions, queue processing and rate-limit consumption are service-only.
Future default grants deny anonymous and PUBLIC access for objects created by
the migration's database owner. Objects created by other database owners
require the same access review.

## External approval and share links

Listings include an external-sharing flag and an authorization record containing
the listing agent's identity, timestamp and seller/marketing authorization.
The default flag is off. The database restricts approval to the listing agent.

Share-link creation validates the caller, listing status, listing-agent
verification and recorded authorization. Each link is scoped to one listing
and the sharing account. Tokens contain 32 random bytes and are stored as
SHA-256 hashes.

The sharing agent can manage expiry, revoke a link or replace it atomically.
Turning external sharing off revokes existing listing links. Access also
requires current listing eligibility and verification of the sharing agent.

## Buyer and Hot Sheet responses

Buyer-facing RPCs return explicit listing fields, authorized media references
and the sharing-agent card. They exclude listing-agent contacts, lockbox data,
broker-only notes and agent-only documents.

Valid Hot Sheet tokens and authenticated members receive only that sheet's
approved matches. Privacy readers apply status selection, ZIP, listing type and
number, property codes, city/neighborhood criteria and price-range overlap;
empty status selections yield no matches. The existing notification matcher and
Hot Sheet invitation, draft and personal-sheet rules remain unchanged.

Buyer dashboards, favorites, map results and listing detail
use scoped reads. Recipient membership uses authenticated identity and active
relationships or accepted tokens; editable profile email is not an authority.

Direct relationship creation is restricted to authorized agent account context.
The private recipient helper validates CRM ownership and the buyer's bound
account or confirmed Auth email. Listing and photo access use the same membership
authority. Validated relationship activation records the account binding, and
existing confirmed matches receive the same binding, so a later Auth email
change does not disconnect a legitimate member. The activation RPC retains its existing one-agent and idempotency
behavior behind recipient and invitation checks; its two-argument overload has
no overlapping default with the one-argument wrapper.

The authenticated property page retains full consumer property sections,
favorites, showing requests, messaging, buyer navigation and Hot Sheet return
context. It obtains AAC listing data and the sharing-agent card through
`get_buyer_listing`, without direct network listing or directory reads.
Account and scope changes clear previous details while authorization is checked.

Invitation acceptance remains an authenticated intended-recipient operation.
Workspace-only invitations validate the agent-owned contact and recipient email
without requiring or creating a Hot Sheet association. Emailed Hot Sheet links
open the full buyer page only after authenticated membership is established;
other valid bearer links retain their scoped read-only viewer.
Unavailable listing links return neutral content. Signed-in replacement
requests use throttled in-app notifications to the sharing agent. The sharing
account's workspace displays pending requests and offers listing/link review
and explicit acknowledgement; it does not automatically replace or send links.

## Public DCMLS scope

The DCMLS view and consumer RPCs expose only published listings with current
seller authorization and a visible, verified, participating publishing agent.
`publish_to_dcmls`, published DCMLS status and agent participation are required
independently of AAC external-sharing approval. The same filters apply when a
backend service reads this public source.

Consumer details, profile cards, testimonials, comparison results and media use
this publication scope. DCMLS searches use `dcmls_listings_public` even for a
signed-in buyer. No public branch falls back to raw network listings or profiles.
Public agent contacts belong to the eligible publisher; AAC Hot Sheet contacts
continue to identify the sharing agent. Existing feature flags still control
agent-facing DCMLS UI.

## Media access

| Storage category | Access policy |
|---|---|
| Listing photos and floor plans | Private; verified network, authorized recipient or eligible DCMLS publication signing |
| Seller-intake photos | Private; authorized agent access or the uploader's own folder |
| Email attachments | Private; authorized account/folder access |
| Agent-only listing documents | Private; authorized agent-side access |
| Headshots, agent logos and brand assets | Public branding |

Existing object paths remain valid. Private image and file components resolve
Storage references and request authorized signed access. The recipient media
endpoint accepts the access token in the POST body and resolves object paths
from the authorized database record. Arbitrary caller-supplied object paths
are not signed. Public DCMLS media uses a separate publication-checking,
service-only path resolver. The endpoint rejects mixed DCMLS and token/member
scopes, and browser media caches distinguish these scopes.

Signed URLs request a 600-second lifetime. Revocation stops new URL issuance;
previously downloaded or cached bytes may persist. Original and transformed
CDN cache clearance is part of Storage acceptance.

## Email authorization

Listing-bearing mail carries a versioned permission contract. Automatic buyer
and subscriber notifications are checked before enqueue, and queued listing
mail is rechecked immediately before provider delivery. Manual Hot Sheet
batches include only approved external matches; internal agent recipients
remain separate.

Expired or revoked links, withdrawn authorization and obsolete listing jobs
cannot authorize delivery. Pending listing jobs require current permissions
and links before release. Property email cards use neutral imagery and scoped
page links. Listing-agent attribution is limited to agent-only cards.

Conversation notifications preserve the authored message and conversation
link. Automatic private listing cards are omitted for buyers and recipients
who are no longer verified agents.

Price alerts use service-only production and `get_price_alert_context`, which
resolves the actual Auth email, current favorite and network or Hot Sheet scope.
Buyer history from before the current sharing authorization is excluded. Cards
use neutral imagery and authenticated, scoped page links. Queued jobs record the
recipient and authorization scope; the delivery check rejects removed favorites,
lost membership, changed email, seller opt-out and superseded approval. Verified
network recipients retain internal alerts without requiring external approval.

Favorites sharing delegates to the existing verified-agent bulk sharing handler.
Only listing IDs and recipient fields are forwarded; property content, sender
identity and secure links are resolved by that handler. Obsolete price and
favorites templates without valid permission contracts cannot reach the provider.

## Public endpoints and indexing

Private listing routes expose generic social HTML and brand imagery. Their
metadata contains no private property fields or structured listing data.
The sitemap contains only the public marketing allowlist. Private and unknown
routes receive noindex/noarchive and no-referrer controls; static asset caching
is preserved.

Diagnostics, network aggregates and property history require verified network
authorization. Public DCMLS comparisons are rate-limited and include only
visible, verified participating agents with an eligible publication.
Property-history source records and agent
identities respect caller scope. Property enrichment is restricted to the
listing owner's authorized account context.

Listing inquiry and showing endpoints resolve both authorization and recipients
server-side before recording a request. Network inquiries use authorized network
data; public inquiries use only the DCMLS publication source. Authenticated AAC
buyer showings require the buyer's current Hot Sheet scope and go to the sharing
agent. Caller-supplied destination contacts cannot redirect a request.

Database permissions and restrictive INSERT policies require inquiry and showing
persistence through the authorized handlers. Profile correspondence resolves
network recipients under the caller's RLS. DCMLS profile inquiries require an
eligible publication and Turnstile; administrators retain deliberate outreach.
Global, actor and IP rate limits use service credentials and refuse errors.

Showing and listing-inquiry mail carry listing permission contracts for current
recipient checks before delivery. Fixed-destination platform support uses a
separate template and does not require a listing permission contract.
Public seller matching uses a bounded, rate-limited aggregate endpoint without
exposing agent identities or buyer criteria.

## Operational state

Database migration `20261110120000_privacy_lockdown.sql` is applied and retained
for schema history. Do not reapply it for this release.

`20261110143000_privacy_workflow_repairs.sql` supplies the repaired invitation,
buyer, Hot Sheet and DCMLS database interfaces. It requires the base privacy
schema and must be applied separately before the corresponding backend and
application deployment. It does not enable delivery, cron or public buckets.

`20261110160000_privacy_access_boundary_fixes.sql` requires the preceding privacy
migrations. It adds recipient identity checks, protected activation and inquiry
writes, and the service-only price-alert context and delivery checks. Existing
applied migrations remain unchanged; this follow-up does not enable delivery.

Complete backend and application deployment verification, private Storage
verification and the hosted acceptance matrix. Keep outbound delivery, cron
and social publishing paused until separately approved.
