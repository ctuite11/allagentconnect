# AAC Monogram JPEG for Email Profile Photo

Produce a clean, correct monogram JPEG you can upload as your email (Gmail/Outlook) profile photo.

## What I'll do

- Use the current green monogram already used in the invite email header (`public/email/aac-monogram-green-128.png`) as the source of truth — the same mark recipients see in AAC emails.
- Upscale it cleanly to a 1024x1024 square with a solid white background and even padding around the mark (no cropping, no stretching).
- Export as a high-quality JPEG and deliver it as a downloadable file.

## Notes

- Source file is 128px, so upscaling will be done with a high-quality resample. If it looks soft at 1024px, I'll re-render from the vector monogram artwork instead to get a crisp result, keeping the exact same green mark and white background.
- No changes to any email template, storage bucket, or app code — this is an asset export only.
