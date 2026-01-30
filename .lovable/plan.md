
# Fix: Share Button Should Link to Registration Funnel

## Problem
When users share a listing via social media, clicking "View on Facebook" takes them directly to the listing page (`/property/:id`). According to the marketing strategy, public share links should route to the **Early Access registration page** (`/register?listing_id=UUID&source=social`) so unregistered agents must sign up to view the listing.

## Current vs Expected Behavior

| Share Channel | Current URL | Expected URL |
|---------------|-------------|--------------|
| Copy Link | `/property/abc123` | `/register?listing_id=abc123&source=social` |
| Facebook | `/property/abc123` | `/register?listing_id=abc123&source=social` |
| LinkedIn | `/property/abc123` | `/register?listing_id=abc123&source=social` |
| Twitter | `/property/abc123` | `/register?listing_id=abc123&source=social` |

## Solution Overview

Two changes are needed:

1. **Update share URL generator** to point to the registration funnel
2. **Create new edge function** to serve listing-specific OG metadata for `/register` URLs when crawlers visit

---

## Technical Implementation

### 1. Update `src/lib/getPublicUrl.ts`

Change `getListingShareUrl` to generate registration funnel URLs:

```typescript
export const getListingShareUrl = (listingId: string): string => {
  return `${getPublicOrigin()}/register?listing_id=${listingId}&source=social`;
};
```

### 2. Create Netlify Edge Function for `/register`

**New file:** `netlify/edge-functions/register-social-preview.ts`

This edge function will:
- Only intercept requests from crawlers (Facebook, Twitter, etc.)
- Extract `listing_id` from query params
- Proxy to the existing Supabase `social-preview` function to get listing OG metadata
- Pass regular users through to the SPA

### 3. Add Edge Function Route to `netlify.toml`

```toml
[[edge_functions]]
  path = "/register"
  function = "register-social-preview"
```

---

## Data Flow After Fix

```text
Agent clicks Share → URL: /register?listing_id=abc123&source=social

             ┌─────────────────────────┐
             │  Netlify Edge Function  │
             │  register-social-preview│
             └───────────┬─────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
       Crawler?                    Regular User?
          │                             │
          ▼                             ▼
   ┌─────────────────┐          ┌────────────────┐
   │ Fetch listing   │          │ React SPA      │
   │ OG metadata     │          │ /register page │
   │ from Supabase   │          │ (shows form +  │
   │ (price, photo)  │          │  video modal)  │
   └─────────────────┘          └────────────────┘
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/getPublicUrl.ts` | Modify: Update URL pattern |
| `netlify/edge-functions/register-social-preview.ts` | Create: New edge function |
| `netlify.toml` | Modify: Add edge function route |

---

## Edge Function Logic

The new edge function will:

1. Check if visitor is a crawler using User-Agent regex
2. If crawler AND `listing_id` param exists:
   - Fetch listing data from Supabase
   - Return HTML with property-specific OG tags (price, photo, address)
3. If not a crawler OR no `listing_id`:
   - Pass through to SPA (`context.next()`)

---

## Verification Steps

1. Navigate to any listing and click "Share"
2. Select "Copy Link" → verify URL is `/register?listing_id=...&source=social`
3. Paste in Facebook Debugger → verify property photo and price appear in OG preview
4. Click the link in Facebook → verify it opens the registration page with video modal

---

## Impact

- **Marketing funnel**: All social shares now drive Early Access signups
- **OG previews**: Still show property-specific images and pricing
- **Attribution**: Registration captures `listing_id` and `source=social` for analytics
