

# Upload Logo SVGs to Brand Assets Storage

## Problem
The generated SVG files don't render properly as local downloads. You need permanent public URLs.

## Solution
Upload all four logo SVG files to the existing `brand-assets` storage bucket, giving you permanent public URLs like:
- `https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/aac-logo-white.svg`
- `https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/aac-logo-black.svg`
- `https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/aac-logo-green-white.svg`
- `https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/brand-assets/aac-logo-green-black.svg`

## Approach
Write an edge function script (or use a one-off exec) to upload the SVG content directly to the `brand-assets` bucket via the Supabase Storage API. The bucket is already public, so the URLs will be immediately accessible.

## Files
- No project files modified
- Four SVGs uploaded to existing `brand-assets` storage bucket

