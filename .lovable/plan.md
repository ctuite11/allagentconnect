## Scope
Fix photo uploads on `ManageListingPhotos` so iPhone HEIC and larger phone photos are accepted, with clear error messages. No RLS or path changes.

## Changes

**1. `listing-photos` bucket (via `supabase--storage_update_bucket` is public-only; size/mime need SQL)**
- `file_size_limit`: 10 MB → **25 MB** (26,214,400 bytes).
- `allowed_mime_types`: keep web-safe only — `image/jpeg`, `image/png`, `image/webp`, `image/jpg`. **Not** adding `image/heic`/`image/heif` (conversion happens client-side). Not adding AVIF — downstream email/OG paths aren't verified for it.
- `listing-floorplans`: untouched.

**2. Client-side HEIC → JPEG conversion**
- Add dependency: `heic2any` (browser-only, ~200KB, widely used).
- In `src/pages/ManageListingPhotos.tsx` `handleFileSelect`, before upload:
  - Detect HEIC/HEIF by MIME (`image/heic`, `image/heif`) or extension (`.heic`, `.heif`) — Safari sometimes reports empty MIME.
  - Convert via `heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })`, wrap the result in a new `File` with a `.jpg` name so downstream storage/display sees a real JPEG.
  - heic2any preserves EXIF orientation in the rasterized output by baking rotation into pixels — acceptable behavior.
  - Only load `heic2any` via dynamic `import()` inside the HEIC branch so non-HEIC uploads don't pull the lib.

**3. Clearer error toasts in `ManageListingPhotos.tsx`**
Replace the single `Failed to upload {filename}` with categorized messages:
- Pre-upload size check: file > 25 MB → `"{filename} is too large (max 25 MB)"`.
- Pre-upload format check: not in `[jpeg, jpg, png, webp, heic, heif]` → `"{filename}: unsupported format. Use JPG, PNG, WEBP, or HEIC."`.
- HEIC conversion throws → `"{filename}: couldn't convert HEIC to JPEG. Try exporting as JPG from your phone."`.
- Storage upload throws → surface Supabase message when present (`Payload too large`, `mime type … is not supported`, else generic `"{filename}: upload failed — {message}"`).
- Keep the existing success toast unchanged.

**4. Out of scope / follow-ups**
- Do NOT touch storage folder layout (`${listingId}/…`) or the RLS mismatch with `${auth.uid}/…`. Logged as a separate follow-up task in `.lovable/plan.md` under a new "Follow-ups" section so it isn't lost.
- No changes to `listing-floorplans`, listing status handling, photos JSON shape, or any other page.

## Verification (manual, after deploy)
- iPhone HEIC photo → converts and uploads as `.jpg`.
- 15 MB JPEG → uploads.
- 30 MB JPEG → rejected with size message before hitting storage.
- Ordinary JPG/PNG/WEBP → unchanged behavior.

## Files touched
- `supabase/migrations/<ts>_listing_photos_bucket_limits.sql` — update size/mime on `storage.buckets` row for `listing-photos`.
- `src/pages/ManageListingPhotos.tsx` — HEIC conversion + error toasts.
- `package.json` — add `heic2any`.
- `.lovable/plan.md` — append the storage-path/RLS follow-up.

Nothing else changes.