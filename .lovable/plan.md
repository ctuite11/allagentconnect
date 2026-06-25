## Goal

You saw a **broken image icon** (not a gray "Photo unavailable" box) on the hot sheet email in **Gmail mobile**. That means the `<img src>` is present and pointed at a real URL, but Gmail's image proxy (`ci3.googleusercontent.com`) tried to fetch it and got back something it could not render — non-200 status, non-image content-type, redirect loop, or a blocked user-agent. This is almost always a server/CDN problem, not a layout problem, and it usually affects desktop too once images are unblocked (desktop Gmail often caches the same proxy result, so "didn't check desktop yet" is expected).

This plan is **diagnosis only — no code changes yet.** I want to identify which of the three known failure modes you actually hit before proposing a fix, because the fixes are very different.

## How the photo URL gets built

`process-hot-sheet` → `renderHotSheetMatchListingEmailCard(listing)` → `resolveEmailPhotoUrl(listing.photos)`:

1. Pulls `photos[0]` from the listing row.
2. If it's a string starting with `http`, runs `rewriteToCdn()` — rewrites Supabase storage URLs onto `https://cdn.allagentconnect.com/...`. Any non-Supabase URL (MLS/IDX host, S3, etc.) passes through untouched.
3. If it's a relative path, prefixes `https://cdn.allagentconnect.com/storage/v1/object/public/listing-photos/<path>`.

So the rendered `<img src>` is one of:
- A. `cdn.allagentconnect.com` URL (our own CDN CNAME in front of Supabase storage).
- B. An external MLS/IDX/S3 URL (anything not matching the Supabase storage path pattern).
- C. A broken/malformed URL because `photos[0]` is an object whose `url`/`publicUrl`/`src`/`image_url` field is empty.

## Three candidate root causes

1. **External MLS photo blocked by Google's image proxy.** Gmail mobile only loads images via `ci3.googleusercontent.com/...`. Many MLS/IDX photo hosts return 403 to the GoogleImageProxy UA or require a Referer header. Result: broken-image icon. Desktop browsers fetching directly would still work; Gmail web inherits the same proxy, but the cached result may differ from mobile.
2. **`cdn.allagentconnect.com` returns a non-image response.** If the listing's storage path is wrong (file deleted, wrong bucket, missing extension) the CDN serves an HTML 404 page with `content-type: text/html`. Gmail proxy fetches HTML, can't render → broken-image icon.
3. **CDN CORS / cache miss on the CNAME from Google's proxy IPs.** Less likely but possible: if `cdn.allagentconnect.com` is behind a CDN config that blocks certain UAs or sends an unexpected redirect, the proxy will fail.

## Diagnostic steps (read-only)

Step 1 — Identify the exact listing(s) and `<img src>` URLs from the email you just received:
- Query the most recent `email_jobs` row with `payload->>template = 'hot-sheet-alert'` and your address as recipient.
- Extract `payload.variables.listingsHtml`, pull out every `<img src="...">`, and list the URLs.

Step 2 — For each URL, fetch with `curl -I` from server + with `User-Agent: GoogleImageProxy` to mimic what Gmail does:
- Record HTTP status, `content-type`, `content-length`, any redirect chain.
- Classify: success (image/*), HTML 404, 403 with UA check, redirect loop, or DNS/cert error.

Step 3 — Cross-check the underlying listing row(s):
- Read `listings.photos` for each listing ID in the email.
- Confirm whether the first photo is a Supabase storage path, an external MLS URL, or a malformed object.

Step 4 — Report the verdict in one paragraph: which of the three candidates is the actual cause, with the failing URL and the curl evidence. Only then do I propose a fix.

## What this plan does NOT do

- No edits to `process-hot-sheet`, `listingEmailCard.ts`, `listingPhotoUrl.ts`, or the template.
- No re-send of the alert.
- No layout/CSS changes to the compact card.
- No DNS or CDN configuration changes.

## Verification

Diagnosis is complete when I can tell you: "URL `<X>` returned `<status>` `<content-type>` to GoogleImageProxy — that's why Gmail mobile shows the broken icon."
