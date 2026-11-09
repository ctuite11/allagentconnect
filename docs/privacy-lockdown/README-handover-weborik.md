# AAC Privacy Lockdown — Handover for Nenad (Weborik)

Status: **STAGED. Nothing here has been applied to production.** Chris must approve each production step explicitly.

## Stage 1 — done (local throwaway database, fake data)

- `scripts/run-privacy-lockdown-tests.sh` starts a temporary Postgres in `/tmp` on a Unix socket only, with every `PG*`/`DATABASE_URL` variable unset first. Nothing can reach production. It deletes itself when it finishes.
- `supabase/tests/db/20_privacy_lockdown_fixture.sql` recreates the affected production objects, using the same names and signatures and fake rows only.
- The tests run in three phases: current behaviour, then after `01_lockdown_up.sql`, then after `02_lockdown_down.sql`.

Result: **ALL PRIVACY LOCKDOWN ASSERTIONS PASSED**

| Viewer | Before | After lockdown | After rollback |
|---|---|---|---|
| Signed-out | Sees all listings, every agent profile (including hidden, invited and unverified), presence, radius search | DENIED on every probe | Still DENIED (rollback does not reopen public access) |
| Invited / unverified / restricted | Sees everything | 0 rows | Original signed-in behaviour restored |
| Verified agent | Sees everything | Listings unchanged; hidden, invited and unverified agents no longer returned | Original |
| Hidden agent | — | Can still see their own profile | Original |

Limits of this test: the fixture uses stand-in versions of the function bodies. The real bodies are preserved untouched as `<name>__ungated`. `seller_matches_public` is a security-invoker view, so it relies on the `seller_matches` RLS policies, which the fixture does not reproduce.

## Files

- `01_lockdown_up.sql` covers `listings_public`, `dcmls_listings_public` and `seller_matches_public`, plus 9 lookups: `get_public_agent_profile`, `get_public_listing`, `get_public_listing_agent`, `get_verified_agent_ids`, `get_newest_verified_agents`, `get_agent_presence`, `get_listing_interest_signals`, `listings_within_radius`, `get_dcmls_listing`. For each lookup it renames the original to `__ungated` (no grants) and adds a wrapper with the same signature that requires `is_verified_agent()`. It revokes anon access. View definitions are backed up in `privacy_lockdown_backup`.
- `02_lockdown_down.sql` restores the original functions and views for signed-in users and **never re-grants anon**.

## Stage 2 — for Weborik's independent Supabase + Netlify environment

Conditions: use no copied real user data (seed fakes from the fixture), send no email (unset `RESEND_API_KEY`), and have no connection to production. Agree the timing with Chris before integration testing.

1. Apply `01_lockdown_up.sql` to the staging copy of the real schema. Run the app as signed-out, invited, unverified, verified and hidden test accounts.
2. Review the remaining **150 SECURITY DEFINER functions** that anon can execute (49 of them are trigger functions, which cannot be called directly). The other ~100 need a per-function keep/revoke decision. Known keepers include token-scoped flows such as `get_hot_sheet_by_token` and `accept_client_hot_sheet_invite`, and `get_verified_early_access_count`. `resolve_share_token` currently returns the whole token row and should return only the fields the page needs.
3. Many public tables still grant SELECT to anon and rely on RLS alone. Revoke anon table grants except where a signed-out flow is required.
4. Storage: these buckets are **public** today: `listing-photos`, `listing-floorplans`, `agent-match-photos`, `email-attachments`, `agent-headshots`, `agent-logos`, `brand-assets`. The plan is to move confidential photos and floor plans into private buckets served by an image service that checks access (Email Option B: no reusable buyer codes in image URLs). Not built yet; it needs this environment to test.
5. Website, prepared but not applied: `X-Robots-Tag: noindex` on every route except the marketing allowlist; a signed-out guard on `/agent/*` and `/property/*`; and `/property/*` social previews must stop returning address, price, description and photo.

## Known impact to decide before production

- **Listing share links are not token-based today.** Guest access is decided in the browser (`SharedListingGate`). After the lockdown, signed-out people who open shared listing links, including links in sent emails and social posts, would be asked to sign in, unless a new token-checked share lookup is built first.
- Hot Sheet email links use tokens, so they can keep working through their token functions (verify this in Stage 2).
- Previously sent emails that embed public photo URLs will show broken images once those buckets become private. The proposal is to keep existing objects reachable through the image service.

## Proposed production sequence (each step needs Chris's approval)

1. Website headers and route guards.
2. Database lockdown (`01`), followed by checks on all three domains.
3. Function and table grant cleanup.
4. Private buckets and the image service.
5. Rollback path for any step: `02_lockdown_down.sql`, or revert the website change. Neither reopens public access.

## Update — Secure share links (staged, locally tested)

Files: `03_secure_share_links_up.sql`, `04_secure_share_links_down.sql`, `edge-function-draft/shared-listing-photos.ts`.

How it works:
- A verified agent creates a link for one public-status listing. It expires after 90 days by default (maximum 365). Only a SHA-256 hash of the token is stored, and the agent can revoke the link.
- `get_shared_listing(token)` is the only lookup open to signed-out visitors. It returns that one listing's safe fields and the sharing agent's contact card.
- The link stops working when it expires, is revoked, the listing leaves public status, or the sharing agent is no longer verified.
- Photos are served by the edge function: the token goes in the POST body, and the function returns 10-minute signed URLs from a private bucket.

Local result: **20/20 share-link assertions passed**. The lockdown and rollback assertions also passed. Not yet built: the app screens (share button and `/s/<token>` page). These are deliberately not added to the live code, because saving to `main` deploys automatically.

### Impact on existing links and emails

| Item | What happens after lockdown | Plan |
|---|---|---|
| Hot Sheet invitation links (52 tokens, 10 still valid) | Keep working. Token-based. | Verify in staging. |
| Plain `/property/<id>` links already shared (emails, texts, social posts) | Cannot be preserved securely: there is no token, so anyone with the ID could read the listing. | Signed-out visitors see a "This link has been updated. Ask your agent for a new link" page with no listing data. Agents re-share with new links. Optional: notify agents with a list of their recent shares (needs approval; no sends). |
| Photos inside already-sent Hot Sheet / listing emails (public bucket URLs) | Break if the originals are moved or deleted. | Recommended: put new uploads in the private bucket, leave existing public objects in place for a fixed grace period (e.g. 90 days), then remove them. Chris decides the length. |
| Agent headshots and logos, brand assets | Unchanged (public by design). | — |
