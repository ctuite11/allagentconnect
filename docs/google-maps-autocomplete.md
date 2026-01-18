# Google Maps Address Autocomplete

This document explains how Google Maps / Places Autocomplete is configured across production (Netlify) and Lovable preview, and how to debug issues quickly.

---

## Overview

Address autocomplete uses the **Google Maps JavaScript API + Places API**.  
Because this is a frontend feature, the API key is public by design and secured via domain (referrer) restrictions in Google Cloud Console.

Due to build-time differences, production and preview environments load the key differently.

---

## Production Setup (Netlify)

### Environment Variable

Set the following **build-time environment variable** in Netlify:

```
VITE_GOOGLE_MAPS_API_KEY
```

**Important notes:**

- `VITE_*` variables are baked into the frontend bundle at build time
- Netlify injects this correctly during production builds
- No query params or localStorage are needed in production

### Expected Behavior

- `/agent-match` loads autocomplete automatically
- No console warnings
- No URL parameters required

---

## Lovable Preview Setup

### Why This Is Different

Lovable preview builds:

- Do **not** reliably inject `VITE_*` variables into `import.meta.env`
- Cloud secrets are available to edge/runtime code, not to Vite's build step

Because of this, preview **cannot rely on** `VITE_GOOGLE_MAPS_API_KEY`.

### Preview Workaround (Supported by Code)

Open the preview URL **once** with the API key as a query param:

```
/agent-match?gmaps_key=YOUR_GOOGLE_MAPS_API_KEY
```

**What happens:**

1. The app detects `gmaps_key` in the URL
2. The key is stored in: `localStorage["aac_gmaps_key"]`
3. All future visits to `/agent-match` work without the query param (in the same browser)

### Verifying in Console

Run:

```javascript
new URLSearchParams(window.location.search).get("gmaps_key")
localStorage.getItem("aac_gmaps_key")
```

**Expected:**

- First returns the key (on initial load)
- Second returns the stored key (after reload)

Console logs will show:

```
[AddressAutocomplete] gmaps key source: url
[AddressAutocomplete] key present: [yes]
[AddressAutocomplete] Google Places ready.
```

---

## Google Cloud Console Requirements

### APIs (Must Be Enabled)

- ✅ Maps JavaScript API
- ✅ Places API

### Key Restrictions (Required)

**API restrictions**

- Restrict to: Maps JavaScript API + Places API only

**HTTP referrer restrictions**

Include:

- Production domain(s), e.g. `https://allagentconnect.com/*`
- Lovable preview domains, e.g.:
  - `https://*.lovable.app/*`
  - `https://*.lovableproject.com/*`

---

## Troubleshooting Guide (Read the Console)

The component is intentionally loud when something is wrong.

Look for these exact errors in the browser console:

| Error | Meaning | Fix |
|-------|---------|-----|
| `RefererNotAllowedMapError` | Domain not allowed | Add preview domain to referrers |
| `ApiNotActivatedMapError` | Places API disabled | Enable Places API |
| `BillingNotEnabledMapError` | Billing not enabled | Enable billing in Google Cloud |
| `InvalidKeyMapError` | Bad/disabled key | Rotate or re-enable key |
| `Google Maps script loaded but Places unavailable` | Partial API config | Check APIs + restrictions |

If autocomplete is disabled, the UI will show:

```
Autocomplete disabled (missing key)
```

This is intentional — no silent failures.

---

## Quick Reference

### One-Line Preview Test

```
/agent-match?gmaps_key=YOUR_KEY
```

### Production

- Uses `VITE_GOOGLE_MAPS_API_KEY`
- No query param required

---

## Security Notes

- Google Maps keys are **public by design**
- Security is enforced via **API + referrer restrictions**, not secrecy
- Never reuse a key that was pasted into chat — rotate immediately
