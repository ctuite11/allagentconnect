

# Configure Video for Registration Funnel

## Overview
Your video is uploaded to Cloudflare Stream and ready. This plan covers configuring the environment variable to activate the video on the `/register` page.

## What You Need To Do (in Netlify)

### Step 1: Add Environment Variable
1. Go to your Netlify dashboard → Site settings → Environment variables
2. Add a new variable:
   - **Key:** `VITE_REGISTER_VIDEO_EMBED_URL`
   - **Value:** `https://customer-1vv02j3t0mqd2nts.cloudflarestream.com/07ed3075fab03ce4c55bf8c97798224c/iframe`

### Step 2: Trigger Redeploy
Since `VITE_` variables are bundled at build time, you need to redeploy:
- Go to Deploys → Trigger deploy → Deploy site

### Step 3: Configure Allowed Origins (Optional but Recommended)
Back in Cloudflare Stream (your screenshot), add your domains to "Allowed Origins":
```
allagentconnect.lovable.app,allagentconnect.com
```
This prevents the video from being embedded on unauthorized sites.

## What I Will Implement

Once the environment variable is set, no code changes are needed. The existing implementation will automatically:

1. **Show video thumbnail** on `/register?listing_id=UUID` 
2. **Auto-open video modal** when `autoplay=1` is in the URL
3. **Hide video block** on generic `/register` (no listing_id)

## Test URLs After Deployment

- **With video thumbnail:** `https://allagentconnect.com/register?listing_id=12345678-1234-1234-1234-123456789abc`
- **With auto-play:** `https://allagentconnect.com/register?listing_id=12345678-1234-1234-1234-123456789abc&autoplay=1`

## Technical Notes

- The iframe already supports autoplay parameters via `?autoplay=1&muted=1`
- Cloudflare Stream handles adaptive bitrate streaming automatically
- Mobile browsers typically require muted autoplay, which is already configured

