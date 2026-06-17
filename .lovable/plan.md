# Fix Google Maps via configuration only

No file changes. Keep the single existing key path `VITE_GOOGLE_MAPS_API_KEY`. Both agent and buyer maps already read from it — confirmed in:

- `src/components/PropertyMap.tsx`
- `src/components/AddressAutocomplete.tsx`
- `src/pages/BuyerMapSearch.tsx`
- `supabase/functions/auto-fetch-property-data/index.ts` (server-side)

## What I verified

- `VITE_GOOGLE_MAPS_API_KEY` is **present in the sandbox environment** (injected at build).
- It is **not written into `.env`** in the repo (which is correct — it's managed as a project env var).
- Same key path is used everywhere; no buyer-specific code is involved.

Conclusion: this is a Google Cloud configuration issue (referrer allowlist on the key), not an app bug.

## Action items for you in Google Cloud Console

Open the API key currently set as `VITE_GOOGLE_MAPS_API_KEY` and update **Application restrictions → HTTP referrers** to include all of:

```text
https://allagentconnect.com/*
https://www.allagentconnect.com/*
https://directconnectmls.com/*
https://www.directconnectmls.com/*
https://*.lovable.app/*
https://*.lovableproject.com/*
```

Add any Netlify preview domains you use as well (e.g. `https://*.netlify.app/*` or your specific `https://<site>--<branch>.netlify.app/*`).

Also confirm **API restrictions** on the key include, at minimum:
- Maps JavaScript API
- Places API (and/or Places API New, matching what the app loads)
- Geocoding API

Billing must be enabled on the Google Cloud project.

## Validation after you save the changes

1. Hard refresh `/client/search?lt=for_rent` on `id-preview--…lovable.app`.
2. Check the browser console — there should be **no** `RefererNotAllowedMapError` / `REQUEST_DENIED`.
3. Repeat on `https://allagentconnect.com` once published.

If errors persist, paste the exact console error and I'll diagnose next.

## Out of scope (per your instruction)

- No fallback to `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`.
- No code edits to `PropertyMap.tsx` or `AddressAutocomplete.tsx`.
