
The issue is identified: that PNG object exists in storage, but it was uploaded as an empty file.

What I found:
- The `brand-assets` bucket is public and readable, so this is not a permissions problem.
- `aac-logo-green-black.png` exists, but its metadata shows:
  - `contentLength: 0`
  - `size: 0`
  - PNG mime type, but no image data
- Same problem affects some other PNG logo files too:
  - `aac-logo-black.png`
  - `aac-logo-green-white.png`
  - `aac-logo-green-black.png`
- The outlined SVG version does exist with real content:
  - `aac-logo-green-black-outlined.svg` has non-zero size and should be usable.

Plan:
1. Regenerate the whole-logo PNG files so they contain actual image data.
2. Re-upload the broken PNG assets to the existing `brand-assets` bucket using the same filenames.
3. Verify each uploaded file has non-zero size and opens correctly.
4. Return the corrected public URLs, plus recommend using the outlined SVGs when possible for maximum sharpness.

Expected outcome:
- `https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/aac-logo-green-black.png` will render normally after re-upload.
- The SVG URLs should already be the safer option for web/email where supported.

Technical note:
This is a storage content issue, not a frontend issue. No app code changes are needed unless you also want me to update any in-app references to point to the outlined SVG versions instead of the PNGs.
