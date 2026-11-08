# AAC Concierge: secure property photo handoff — staging-only implementation gate

**Status: design and acceptance plan only. NO photo transfer deployed, enabled or executed.**
**Owner:** existing AAC migration team / staging integration; this is not a new production service request.

## Why this must wait for the privacy migration

- Members upload up to 10 JPG/PNG/WebP originals to **private** `concierge-request-photos` with paths under `<agent_uuid>/<request_uuid>/`.
- The existing Add Listing and Manage Listing Photos workflows store public URLs in `listings.photos` and upload into the currently **public** `listing-photos` bucket.
- Putting private off-market Concierge images there would expose them without an authenticated viewer or expiring share token.
- Filling `listings.photos` with short-lived signed URLs is also unsafe/inoperable: they expire and could be unintentionally copied into public listing pages and email previews.
- AAC's privacy handoff already proposes a private bucket `listing-photos-private` and a viewer-authorized photo service, but the renderer/authorization integration must be verified before using it.
- For now **keep originals in private intake**, show them only via 5-minute signed URLs to the submitting agent and AAC admins, and retain the DB publication/review-email holds.

## Prerequisites before implementing a transfer action

1. Confirm a separate, isolated Supabase + Netlify staging deployment with fake member accounts/listings and email sends disabled.
2. Confirm the approved private listing-photo target bucket and viewer authorization route. The target must have `public = false`; verify with `storage.buckets` on the actual *staging* backend, not a frontend guess.
3. Verify image renderers for all relevant paths use an authenticated viewer or expiring, scope-checked token: listing editor, My Listings, listing detail, Hot Sheets, client portals, agent-review page, public marketing pages, and external share links. No raw object path or permanent signed URL may become public.
4. Verify the admin-only conversion endpoint ties original request `agent_id`, `request_id`, and `listing_id` together and the listing is a Draft with `creation_source = 'admin_concierge'`.
5. Agree how a transferred photo is represented in `listings.photos` (bucket, object key, order), with the photo-service contract, instead of writing a public URL.
6. Review the missing-photo / partial-upload recovery and rollback behavior before enabling the button.

## Proposed transfer flow (not implemented)

- On **one explicit admin click**, require the admin JWT and verify all request/listing ownership and status links server-side.
- Enumerate only the `photo_paths` already recorded for this request (max 10); reject foreign paths, invalid MIME, missing originals, or changed request ownership.
- Copy each original **server-side** to an agent/listing-scoped destination key in the private listing-photo bucket. Never accept a destination from the browser.
- Make transfer idempotent using request ID, listing ID and original object identity: retries must not duplicate photos, change ownership or overwrite unrelated objects.
- Verify every destination object, then update the draft's photo references in one DB transaction or recoverable operation. Keep the originals until listing references and rendering are verified; never mark the request done after partial transfer.
- Only after *all* photos exist in the private destination and the owner / authorized agent can view them should the DB draft→live gate and agent-review email hold be reconsidered. Do not remove these safeguards just because a storage call returned success.
- The admin then manually sends the agent review email; the agent must explicitly publish. No network broadcasts and no auto-publish.

## Required staging tests

- 0, 1, and 10 photos; max-size 10MB image; reject invalid MIME, oversized object, corrupted file and forbidden object paths.
- Signed-out, invited/unverified/hidden agent, unrelated verified agent, owning verified agent, admin. No photo exposure to unauthorized users, including guessed URLs, expired/revoked share links, image previews and social metadata.
- Admin cross-agent forgery, different request ID, different listing ID, closed request, published listing, and non-admin caller all rejected without storage writes.
- Repeat/concurrent clicks produce one ordered set; simulate failure after 1 of 10 copies and confirm no partial publication / email and safe retry.
- Test Google/manual address, formatted price/sq ft and condo fee/parking prefill separately so intake correctness is not hidden by media work.
- No real email sends or listing publication in staging. Check that normal published listing photo rendering still works after the privacy migration.

## Release boundary

Do **not** add a public-bucket photo copy, disable the existing SQL publication guard, or activate agent-review emails for requests with pending private photos in PR #107 before these tests pass.

Pending migration integration: regenerate `docs/database/schema_snapshot.sql` from the migrated staging schema, resolve Schema Drift Check, review the complete change with Nenad and coordinate deployment only after the agreed Nov 8–9 cutover.
