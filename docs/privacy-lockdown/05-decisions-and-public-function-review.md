# Privacy Policy and Access Requirements

The privacy controls in the code base enforce the following access and sharing
requirements. The base privacy migration is applied. The workflow repair
migration requires separate destination deployment before application release.
The access boundary migration must also be applied before the associated backend
and application release.

## Confidential media

Confidential property photos and floor plans require private Storage access.
There is no public-access grace period. Authorized viewers receive temporary
signed media URLs after their listing or Hot Sheet scope is validated.

Email uses neutral property imagery and links to the secure page. Reusable
buyer access tokens are never embedded in image URLs. Existing public image
addresses must stop returning confidential images at cutover.

Previously downloaded content and browser or CDN caches cannot be recalled.
Cache clearance and anonymous-access checks are required for existing public
media addresses.

## Buyer contact identity

Buyer-facing listing pages display the sharing agent, labelled Your Agent /
Shared by. Hot Sheet pages display the Hot Sheet owner's card. The listing
agent's identity and contact details are not automatically attached to buyer
listing responses or email cards. The separate public DCMLS experience displays
the publishing agent's business contact details only for an eligible publication.

## External sharing authorization

Network visibility and external sharing are separate permissions.

- External sharing is disabled by default for every listing.
- The listing agent must record seller authorization and applicable marketing
  restrictions before enabling external sharing.
- Coming-soon and off-market listings require the same explicit authorization.
- Another agent, delegate or administrator cannot record authorization on behalf
  of the listing agent through the external-sharing control.
- Disabling external sharing revokes existing listing links and removes the
  listing from buyer-facing matches and public DCMLS results. Re-enabling requires
  fresh listing links.

DCMLS publication additionally requires `publish_to_dcmls = true`,
`dcmls_status = 'published'`, agent participation, directory visibility and current
verification. External-sharing authorization alone does not publish a listing.
Agent-facing DCMLS controls remain governed by the existing feature flag.

## Link lifecycle

A verified agent can create a link for one authorized listing. Links expire
in 90 days by default, with a maximum lifetime of 365 days. Only a hash of the
access token is stored; the newly issued URL is displayed for copying.

Agents can list, revoke and replace their own links. Replacement revokes the
previous link and issues a new one in a single transaction.

Expired, revoked, withdrawn, unauthorized and obsolete links display:

> This link is no longer available. Ask your agent for a new link.

The unavailable page and its social preview disclose no address, price, photo,
description, listing metadata or agent detail. Signed-out visitors opening a
plain listing-ID URL receive the same neutral result.

Recognized listing-share links support replacement requests from signed-in
buyers. Requests are throttled and notify the sharing agent in-app. They do
not notify the listing agent or send email. The sharing account can review
requests in its workspace, open listing/link management and explicitly mark a
request reviewed. Replacement and delivery remain deliberate agent actions.
Unknown links cannot identify a
sharing agent and disclose no additional information.

## Account access

| Account or context | Access |
|---|---|
| Signed out | Public marketing, designated public intake, eligible DCMLS publications and valid token-scoped flows |
| Invited, unverified or restricted | Own permitted setup; no broad listing or directory access |
| Authenticated buyer | Approved matches within their own authorized Hot Sheets and favorites; eligible public DCMLS publications |
| Verified agent | Authorized AAC network access and approved external sharing |
| Accepted delegate | Authorized account context; seller authorization remains with the listing agent |
| Hidden agent | Own profile remains accessible; excluded from other agents' directory results |
| Administrator | Authorized moderation and administrative access |
| Service role | Internal processing under endpoint-specific authorization and delivery controls |

Hot Sheet membership is bound to the authenticated recipient. Editing a profile
email address does not establish another buyer's membership. Token flows
validate expiry, revocation, ownership and permitted listing scope.

Buyers cannot create representation rows for another agent through the browser.
Existing relationship rows authorize a Hot Sheet only when the CRM contact is
bound to the buyer account or matches the buyer's confirmed Auth email. Accepted
tokens retain their intended-recipient scope. Both activation RPC overloads
validate recipient identity and require a valid invitation or an existing active
relationship before changing representation.

Listing inquiries and showing requests are saved only after server authorization.
Direct browser INSERT into their persistence tables is denied, including requests
that supply a valid private listing ID or an unrelated agent ID.

Automatic price alerts require a current favorite and the recipient's actual
network or Hot Sheet authority. Buyer alerts require current seller approval and
exclude history from before that approval. Delivery rechecks membership,
favorite status, recipient email and the authorization recorded when queued.
Disabling and subsequently renewing sharing cannot revive an obsolete alert.

Profile correspondence requires verified network authority. Public DCMLS
inquiries additionally require a current eligible publication and Turnstile
verification. Agent recipients are resolved server-side; administrators retain
authorized manual outreach. Rate-limit failures refuse the request.

Favorites email sharing uses the verified-agent bulk sharing flow, with listing
IDs, current seller permission and expiring links. Client-authored property HTML
and arbitrary page URLs cannot authorize a delivery. Legacy favorites and price
alert jobs without permission contracts are refused by the workers.

Workspace-only invitations are valid without a Hot Sheet when the contact belongs
to the inviting verified agent and the invitation email matches that contact.
Acceptance still requires the intended authenticated recipient and does not
create Hot Sheet membership. A bearer link alone does not grant buyer workspace
actions. Signed-in Hot Sheet members opening an emailed sheet listing can enter
the full property page after a fresh membership check.

## Public database interface

Anonymous database execution is limited to:

- `get_dcmls_agent_profile`
- `get_dcmls_consumer_listings`
- `get_dcmls_listing`
- `get_dcmls_listing_agent`
- `get_delegate_invite_preview`
- `get_hot_sheet_by_token`
- `get_shared_hot_sheet`
- `get_shared_listing`
- `get_verified_early_access_count`
- `migration_no_contact_status`
- `resolve_share_token`

Public tokens and DCMLS RPCs return bounded, explicit responses. Anonymous
table/view reads are limited to static county data and the publication-filtered
`dcmls_listings_public` view. Raw listings, network profiles, confidential paths
and agent-only records remain inaccessible. Designated intake tables accept submissions
without granting network read access. System processing functions remain
restricted to the service role.

The [function access reference](07-effective-function-access.md) records the
complete execution policy. A function grant does not replace its caller,
record-ownership or RLS checks.
